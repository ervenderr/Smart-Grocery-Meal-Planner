import { describe, expect, it } from 'vitest';
import { rankRecipes } from './rank';
import { resolveStapleSet } from './staples-default';
import { findSubstitutes, hasSubstitute } from './substitutions';
import { buildPantryIndex, pantryHas } from './pantry-index';
import { makeSeededDataset } from './test-helpers';
import type { RulesContext } from './types';

const MID_PHONE_BUDGET_MS = 100;
const DESKTOP_SAFETY_FACTOR = 3.5;
const DESKTOP_BUDGET_MS = MID_PHONE_BUDGET_MS / DESKTOP_SAFETY_FACTOR;
const SUBSTITUTE_BUDGET_MS = 1;
const RUNS = 20;
const SUBSTITUTE_CALLS = 200;
const TODAY = '2026-10-10';

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};
const p95 = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1)];
};
const time = (fn: () => unknown): number => {
  const start = performance.now();
  fn();
  return performance.now() - start;
};

const data = makeSeededDataset({ seed: 42, recipes: 500, pantry: 200, today: TODAY });
const ctx: RulesContext = {
  today: TODAY,
  staples: resolveStapleSet(),
  restrictions: ['vegetarian', 'no peanuts'],
  applyDiet: true,
  onlyReady: false,
  hasSubstitute,
};

describe('rules engine performance gate', () => {
  it('ranks 500 recipes x 200 pantry items inside the desktop-scaled budget', () => {
    rankRecipes(data.recipes, data.pantry, ctx); // warm-up
    const samples = Array.from({ length: RUNS }, () => time(() => rankRecipes(data.recipes, data.pantry, ctx)));
    const med = median(samples);
    const high = p95(samples);
    expect(
      med,
      `rank median ${med.toFixed(2)} ms, p95 ${high.toFixed(2)} ms (budget ${DESKTOP_BUDGET_MS.toFixed(1)} ms)`,
    ).toBeLessThan(DESKTOP_BUDGET_MS);
  });

  it('finds a substitute in under 1 ms per call (median)', () => {
    const index = buildPantryIndex(data.pantry, TODAY);
    const options = { pantryHas: (c: string) => pantryHas(index, c), restrictions: ctx.restrictions };
    const names = data.vocabulary.slice(0, SUBSTITUTE_CALLS);
    findSubstitutes({ ingredientName: names[0], quantity: 1, unit: 'cups' }, options); // warm-up
    const samples = names.map((ingredientName) =>
      time(() => findSubstitutes({ ingredientName, quantity: 1, unit: 'cups' }, options)),
    );
    const med = median(samples);
    expect(med, `findSubstitutes median ${med.toFixed(3)} ms, p95 ${p95(samples).toFixed(3)} ms`).toBeLessThan(
      SUBSTITUTE_BUDGET_MS,
    );
  });
});
