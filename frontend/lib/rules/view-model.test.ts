import { describe, expect, it } from 'vitest';
import {
  buildRowViewModel,
  dietSummary,
  formatMatchLine,
  substituteContextLine,
  truncationNote,
} from './view-model';
import type { IngredientMatch, RankedRecipe } from './types';

const match = (over: Partial<IngredientMatch>): IngredientMatch => ({
  name: 'Flour',
  canonical: 'flour',
  needed: 200,
  unit: 'grams',
  have: 350,
  haveUnit: 'grams',
  status: 'have',
  daysLeft: null,
  hasSubstitute: false,
  ...over,
});

const ranked = (over: Partial<RankedRecipe>): RankedRecipe => ({
  recipeId: 'r',
  name: 'Soup',
  totalTimeMinutes: 20,
  servings: 2,
  rank: 1,
  coveragePercent: 75,
  totalCount: 8,
  haveCount: 6,
  missingCount: 2,
  readyToCook: false,
  expiryBoost: 0,
  score: 0,
  have: [],
  missing: [],
  expiringUsed: [],
  ...over,
});

describe('buildRowViewModel', () => {
  it('builds coverage and missing pill', () => {
    const vm = buildRowViewModel(ranked({}));
    expect(vm.coverageText).toBe('You have 6 of 8 ingredients');
    expect(vm.progressLabel).toBe('75% of ingredients in pantry');
    expect(vm.pills).toEqual([{ kind: 'missing', label: 'Missing 2' }]);
  });
  it('never shows Ready to cook for a recipe with no ingredients', () => {
    const vm = buildRowViewModel(
      ranked({ totalCount: 0, haveCount: 0, missingCount: 0, coveragePercent: 0 }),
    );
    expect(vm.coverageText).toBe('No ingredients to compare');
    expect(vm.pills).toEqual([{ kind: 'missing', label: 'No ingredients listed' }]);
  });
  it('shows ready and expiring pills', () => {
    const vm = buildRowViewModel(
      ranked({
        missingCount: 0,
        readyToCook: true,
        expiringUsed: [
          { name: 'Milk', daysLeft: 2 },
          { name: 'Egg', daysLeft: 0 },
        ],
      }),
    );
    expect(vm.pills.map((p) => p.label)).toEqual([
      'Ready to cook',
      'Uses expiring: Milk (2d left)',
      'Uses expiring: Egg (Today)',
    ]);
    expect(vm.pills[1].kind).toBe('expiring');
  });
});

describe('formatMatchLine', () => {
  it('formats each status', () => {
    expect(formatMatchLine(match({}))).toBe('need 200 g, have 350 g');
    expect(formatMatchLine(match({ status: 'partial', needed: 500, have: 200 }))).toBe(
      'need 500 g, have 200 g (short 300 g)',
    );
    expect(
      formatMatchLine(match({ status: 'unitMismatch', have: 1, haveUnit: 'kg' })),
    ).toBe('have 1 kg (different unit)');
    expect(formatMatchLine(match({ status: 'staple' }))).toBe('pantry staple');
    expect(formatMatchLine(match({ status: 'missing', needed: 2, unit: 'cups', have: 0 }))).toBe(
      'need 2 cups',
    );
  });
  it('omits empty unit labels', () => {
    expect(formatMatchLine(match({ status: 'missing', needed: 3, unit: 'pieces', have: 0 }))).toBe(
      'need 3',
    );
  });
});

describe('dietSummary / substituteContextLine / truncationNote', () => {
  it('summarizes diet', () => {
    expect(dietSummary(['vegetarian', 'no_peanuts'])).toBe('Diet: vegetarian, no peanuts');
    expect(dietSummary([])).toBeNull();
  });
  it('builds substitute context', () => {
    expect(substituteContextLine(match({ name: 'sugar', needed: 1, unit: 'cups' }))).toBe(
      'Recipe needs 1 cup sugar.',
    );
  });
  it('notes truncation only when shown < total', () => {
    expect(truncationNote(120, 50)).toBe('Showing top 50 of 120 recipes.');
    expect(truncationNote(50, 50)).toBeNull();
  });
});
