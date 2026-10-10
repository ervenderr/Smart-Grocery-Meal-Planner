import { readFileSync } from 'fs';
import path from 'path';
import { rankCookFirst } from '../src/modules/intelligence/cook-first';
import { canonicalName } from '../src/modules/intelligence/canonical';

interface ParityCase {
  readonly name: string;
  readonly today: string;
  readonly staples: readonly string[];
  readonly pantry: ReadonlyArray<{ ingredientName: string; expiryDate: string | null }>;
  readonly recipes: ReadonlyArray<{
    id: string;
    title: string;
    totalTimeMinutes: number;
    ingredients: ReadonlyArray<{ ingredientName: string }>;
  }>;
  readonly expected: readonly unknown[];
}

const CASES: readonly ParityCase[] = JSON.parse(
  readFileSync(path.join(__dirname, 'fixtures', 'cook-first-cases.json'), 'utf8'),
);

const utc = (day: string): Date => new Date(`${day}T00:00:00Z`);

describe('rules parity: cook-first (shared fixture with the client engine)', () => {
  it('fixture has at least 8 cases', () => {
    expect(CASES.length).toBeGreaterThanOrEqual(8);
  });

  it.each(CASES.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const ranked = rankCookFirst({
      recipes: c.recipes.map((r) => ({
        id: r.id,
        title: r.title,
        totalTimeMinutes: r.totalTimeMinutes,
        ingredientNames: r.ingredients.map((i) => i.ingredientName),
      })),
      pantry: c.pantry.map((p) => ({
        ingredientName: p.ingredientName,
        expiryDate: p.expiryDate === null ? null : utc(p.expiryDate),
      })),
      staples: new Set(c.staples.map((s) => canonicalName(s))),
      today: utc(c.today),
      limit: 1000,
      includeAll: true,
    });
    const sorted = [...ranked].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    expect(sorted).toEqual(c.expected);
  });
});
