import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { canonicalName } from '@/lib/preferences/canonical';
import { rankRecipes } from './rank';
import { resolveStapleSet } from './staples-default';
import type { RulesPantryItem, RulesRecipe } from './types';

interface ParityCase {
  readonly name: string;
  readonly today: string;
  readonly staples: readonly string[];
  readonly pantry: ReadonlyArray<{
    ingredientName: string;
    quantity: number;
    unit: string;
    expiryDate: string | null;
  }>;
  readonly recipes: ReadonlyArray<{
    id: string;
    title: string;
    totalTimeMinutes: number;
    ingredients: ReadonlyArray<{ ingredientName: string; quantity: number; unit: string }>;
  }>;
  readonly expected: readonly { id: string }[];
}

const FIXTURE = path.resolve(__dirname, '../../../backend/tests/fixtures/cook-first-cases.json');
const CASES: readonly ParityCase[] = JSON.parse(readFileSync(FIXTURE, 'utf8'));

describe('server parity: cook-first-cases.json (name-level semantics)', () => {
  it('fixture has at least 8 cases', () => {
    expect(CASES.length).toBeGreaterThanOrEqual(8);
  });

  it.each(CASES.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const pantry: RulesPantryItem[] = c.pantry.map((p, i) => ({ id: `p${i}`, ...p }));
    const recipes: RulesRecipe[] = c.recipes.map((r) => ({
      id: r.id,
      name: r.title,
      totalTimeMinutes: r.totalTimeMinutes,
      servings: 2,
      ingredients: r.ingredients,
    }));
    const result = rankRecipes(recipes, pantry, {
      today: c.today,
      staples: resolveStapleSet(c.staples),
      restrictions: [],
      applyDiet: false,
      onlyReady: false,
      quantityAware: false,
    });
    const actual = result.items
      .map((i) => ({
        id: i.recipeId,
        coveragePercent: i.coveragePercent,
        score: i.expiryBoost,
        // the engine reports display names; the server reports canonical names
        usesExpiring: i.expiringUsed.map((u) => ({ name: canonicalName(u.name), daysLeft: u.daysLeft })),
      }))
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    expect(actual.map((a) => ({ ...a }))).toEqual(
      c.expected.map((e) => ({ ...e })),
    );
  });
});
