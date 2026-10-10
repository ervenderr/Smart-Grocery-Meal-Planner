import { readFileSync, readdirSync } from 'fs';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildPantryIndex, pantryHas } from './pantry-index';
import { rankRecipes } from './rank';
import { resolveStapleSet } from './staples-default';
import { findSubstitutes, hasSubstitute } from './substitutions';
import { makeSeededDataset } from './test-helpers';
import type { RulesContext } from './types';

const TODAY = '2026-10-10';
const data = makeSeededDataset({ seed: 7, recipes: 120, pantry: 80, today: TODAY });
const ctx: RulesContext = {
  today: TODAY,
  staples: resolveStapleSet(),
  restrictions: ['vegetarian'],
  applyDiet: true,
  onlyReady: false,
  hasSubstitute,
};

function runEngine() {
  const ranked = rankRecipes(data.recipes, data.pantry, ctx);
  const index = buildPantryIndex(data.pantry, TODAY);
  const options = { pantryHas: (c: string) => pantryHas(index, c), restrictions: ctx.restrictions };
  const subs = data.vocabulary
    .slice(0, 60)
    .map((ingredientName) => findSubstitutes({ ingredientName, quantity: 2, unit: 'tbsp' }, options));
  return { ranked, subs };
}

const failingNetwork = (): never => {
  throw new Error('network access is forbidden in the rules engine');
};

describe('rules engine determinism and offline behavior', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('gives deep-equal results online and with fetch/XHR stubbed to fail', () => {
    const online = runEngine();
    vi.stubGlobal('fetch', failingNetwork);
    vi.stubGlobal('XMLHttpRequest', failingNetwork);
    const offlineA = runEngine();
    const offlineB = runEngine();
    expect(offlineA).toEqual(online);
    expect(offlineB).toEqual(offlineA);
  });

  it('does not mutate its inputs', () => {
    const snapshot = structuredClone({ recipes: data.recipes, pantry: data.pantry, ctxR: ctx.restrictions });
    runEngine();
    expect({ recipes: data.recipes, pantry: data.pantry, ctxR: ctx.restrictions }).toEqual(snapshot);
  });

  it('production sources contain no I/O, clock, randomness, logging or Capacitor use', () => {
    const forbidden = ['fetch(', 'localStorage', 'new Date()', 'Date.now', 'Math.random', 'console.', '@capacitor', 'lib/api'];
    const files = readdirSync(__dirname).filter(
      (f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && f !== 'test-helpers.ts',
    );
    expect(files.length).toBeGreaterThan(5);
    for (const file of files) {
      const source = readFileSync(path.join(__dirname, file), 'utf8');
      for (const token of forbidden) {
        expect(source.includes(token), `${file} must not contain "${token}"`).toBe(false);
      }
    }
  });
});
