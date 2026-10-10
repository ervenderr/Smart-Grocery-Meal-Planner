import { describe, expect, it } from 'vitest';
import {
  EXPIRY_POINTS,
  EXPIRY_WINDOW_DAYS,
  MAX_RECIPES,
  MISSING_PENALTY,
  URGENCY_WEIGHTS,
  rankRecipes,
} from './rank';
import type { RulesContext, RulesPantryItem, RulesRecipe } from './types';

const TODAY = '2026-10-10';
const ctx = (over: Partial<RulesContext> = {}): RulesContext => ({
  today: TODAY,
  staples: new Set<string>(),
  restrictions: [],
  applyDiet: false,
  onlyReady: false,
  ...over,
});
const p = (
  ingredientName: string,
  quantity: number,
  unit: string,
  expiryDate: string | null = null,
  id = `${ingredientName}-${unit}-${expiryDate}`,
): RulesPantryItem => ({ id, ingredientName, quantity, unit, expiryDate });
const r = (
  id: string,
  name: string,
  ings: Array<[string, number, string]>,
  totalTimeMinutes = 30,
): RulesRecipe => ({
  id,
  name,
  totalTimeMinutes,
  servings: 2,
  ingredients: ings.map(([ingredientName, quantity, unit]) => ({ ingredientName, quantity, unit })),
});
const first = (recipe: RulesRecipe, pantry: RulesPantryItem[], c = ctx()) =>
  rankRecipes([recipe], pantry, c).items[0];

describe('constants', () => {
  it('are exported with the documented values', () => {
    expect(URGENCY_WEIGHTS).toEqual({ soon: 5, near: 3, week: 1 });
    expect(EXPIRY_WINDOW_DAYS).toBe(7);
    expect(EXPIRY_POINTS).toBe(4);
    expect(MISSING_PENALTY).toBe(6);
    expect(MAX_RECIPES).toBe(500);
  });
});

describe('ingredient status', () => {
  it('have with amounts', () => {
    const m = first(r('1', 'A', [['flour', 200, 'g']]), [p('flour', 350, 'g')]).have[0];
    expect(m.status).toBe('have');
    expect(m.needed).toBe(200);
    expect(m.have).toBe(350);
    expect(m.unit).toBe('grams');
  });

  it('partial counts as missing and gives partial credit', () => {
    const res = first(r('1', 'A', [['flour', 500, 'g']]), [p('flour', 200, 'g')]);
    expect(res.missing[0].status).toBe('partial');
    expect(res.missingCount).toBe(1);
    expect(res.coveragePercent).toBe(40);
    expect(res.readyToCook).toBe(false);
  });

  it('unitMismatch gets full credit and is not missing', () => {
    const res = first(r('1', 'A', [['rice', 2, 'cups']]), [p('rice', 1, 'kg')]);
    const m = res.have[0];
    expect(m.status).toBe('unitMismatch');
    expect(m.have).toBe(1);
    expect(m.haveUnit).toBe('kg');
    expect(res.missingCount).toBe(0);
    expect(res.coveragePercent).toBe(100);
  });

  it('epsilon boundary: 16 tbsp is 1 cup', () => {
    const res = first(r('1', 'A', [['milk', 16, 'tbsp']]), [p('milk', 1, 'cups')]);
    expect(res.have[0].status).toBe('have');
  });

  it('staple when no stock; discrete-count exception', () => {
    const c = ctx({ staples: new Set(['salt', 'pepper']) });
    const res = first(r('1', 'A', [['salt', 1, 'tsp'], ['pepper', 3, 'pieces']]), [], c);
    expect(res.have.map((m) => [m.canonical, m.status])).toEqual([['salt', 'staple']]);
    expect(res.missing.map((m) => [m.canonical, m.status])).toEqual([['pepper', 'missing']]);
  });

  it('stocked staple resolves by quantity', () => {
    const c = ctx({ staples: new Set(['salt']) });
    const res = first(r('1', 'A', [['salt', 10, 'g']]), [p('salt', 5, 'g')], c);
    expect(res.missing[0].status).toBe('partial');
  });

  it('sums duplicate lines in one family', () => {
    const res = first(r('1', 'A', [['flour', 200, 'g'], ['flour', 300, 'g']]), [p('flour', 400, 'g')]);
    expect(res.totalCount).toBe(1);
    expect(res.missing[0].needed).toBe(500);
    expect(res.coveragePercent).toBe(80);
  });

  it('unknown quantity: have when stocked, missing otherwise', () => {
    const recipe = r('1', 'A', [['basil', 0, 'g'], ['thyme', Number.NaN, 'g']]);
    const res = first(recipe, [p('basil', 1, 'g')]);
    expect(res.have.map((m) => m.canonical)).toEqual(['basil']);
    expect(res.missing.map((m) => m.canonical)).toEqual(['thyme']);
  });

  it('quantityAware false is name-level', () => {
    const res = first(
      r('1', 'A', [['flour', 500, 'g']]),
      [p('flour', 1, 'g')],
      ctx({ quantityAware: false }),
    );
    expect(res.have[0].status).toBe('have');
    expect(res.coveragePercent).toBe(100);
  });

  it('hasSubstitute flags missing matches only', () => {
    const c = ctx({ hasSubstitute: (n) => n === 'butter' });
    const res = first(r('1', 'A', [['butter', 1, 'cups'], ['egg', 1, 'pieces']]), [], c);
    expect(res.missing.map((m) => [m.canonical, m.hasSubstitute])).toEqual([
      ['butter', true],
      ['egg', false],
    ]);
    expect(first(r('1', 'A', [['butter', 1, 'cups']]), []).missing[0].hasSubstitute).toBe(false);
  });
});

describe('scoring and sorting', () => {
  it('expiry boost and score formula', () => {
    const pantry = [p('milk', 1, 'liters', '2026-10-11'), p('rice', 1, 'kg', '2026-10-17')];
    const res = first(r('1', 'A', [['milk', 1, 'liters'], ['rice', 1, 'kg'], ['egg', 1, 'pieces']]), pantry);
    expect(res.expiringUsed).toEqual([
      { name: 'milk', daysLeft: 1 },
      { name: 'rice', daysLeft: 7 },
    ]);
    expect(res.expiryBoost).toBe(6);
    expect(res.coveragePercent).toBe(67);
    expect(res.score).toBe(67 + 6 * EXPIRY_POINTS - 1 * MISSING_PENALTY);
  });

  it('ignores expired lots and far expiry', () => {
    const pantry = [p('milk', 1, 'liters', '2026-10-09'), p('rice', 1, 'kg', '2026-10-30')];
    const res = first(r('1', 'A', [['milk', 1, 'liters'], ['rice', 1, 'kg']]), pantry);
    expect(res.expiringUsed).toEqual([]);
    expect(res.missing.map((m) => m.canonical)).toEqual(['milk']);
  });

  it('ready recipes sort above higher-scoring non-ready; ranks are 1-based', () => {
    const pantry = [p('a', 1, 'kg', '2026-10-10')];
    const ready = r('r', 'Ready', [['a', 1, 'kg']]);
    const notReady = r('n', 'Not', [['a', 1, 'kg'], ['b', 1, 'kg']]);
    const out = rankRecipes([notReady, ready], pantry, ctx()).items;
    expect(out.map((x) => [x.recipeId, x.rank])).toEqual([['r', 1], ['n', 2]]);
  });

  it('tie-break chain: time, name, id', () => {
    const a = r('b', 'same', [['x', 1, 'g']], 10);
    const b = r('a', 'same', [['x', 1, 'g']], 10);
    const c = r('z', 'Alpha', [['x', 1, 'g']], 10);
    const d = r('y', 'zzz', [['x', 1, 'g']], 5);
    const out = rankRecipes([a, b, c, d], [], ctx()).items.map((x) => x.recipeId);
    expect(out).toEqual(['y', 'z', 'a', 'b']);
  });

  it('empty recipes sort last with zeros', () => {
    const empty = r('e', 'Empty', []);
    const other = r('o', 'Other', [['x', 1, 'g']]);
    const out = rankRecipes([empty, other], [], ctx()).items;
    expect(out.map((x) => x.recipeId)).toEqual(['o', 'e']);
    expect(out[1]).toMatchObject({ coveragePercent: 0, totalCount: 0, readyToCook: false });
  });
});

describe('filters and caps', () => {
  const chicken = r('c', 'Roast', [['chicken breast', 1, 'kg']]);
  const beef = r('b', 'Beef stew', [['carrot', 1, 'kg']]);
  const veg = r('v', 'Salad', [['lettuce', 1, 'kg']]);

  it('diet filter hides and counts', () => {
    const c = ctx({ applyDiet: true, restrictions: ['vegetarian'] });
    const res = rankRecipes([chicken, beef, veg], [], c);
    expect(res.items.map((x) => x.recipeId)).toEqual(['v']);
    expect(res.hiddenByDiet).toBe(2);
    const off = rankRecipes([chicken, beef, veg], [], ctx({ restrictions: ['vegetarian'] }));
    expect(off.items).toHaveLength(3);
    expect(off.hiddenByDiet).toBe(0);
  });

  it('onlyReady keeps missingCount 0', () => {
    const res = rankRecipes([chicken, veg], [p('lettuce', 1, 'kg')], ctx({ onlyReady: true }));
    expect(res.items.map((x) => x.recipeId)).toEqual(['v']);
    expect(res.hiddenByReady).toBe(1);
  });

  it('caps recipes and reports it', () => {
    const many = Array.from({ length: MAX_RECIPES + 3 }, (_, i) => r(`id${i}`, `n${i}`, [['x', 1, 'g']]));
    const res = rankRecipes(many, [], ctx());
    expect(res.items).toHaveLength(MAX_RECIPES);
    expect(res.recipesCapped).toBe(true);
    expect(res.pantryCapped).toBe(false);
  });

  it('surfaces pantry cap', () => {
    const many = Array.from({ length: 2005 }, (_, i) => p(`thing${i}x`, 1, 'g', null, `i${i}`));
    expect(rankRecipes([chicken], many, ctx()).pantryCapped).toBe(true);
  });
});

describe('purity', () => {
  it('does not mutate inputs and is repeatable', () => {
    const recipes = [r('1', 'B', [['x', 1, 'g'], ['y', 1, 'g']]), r('2', 'A', [['x', 1, 'g']])];
    const pantry = [p('x', 1, 'g', '2026-10-11')];
    const c = ctx({ restrictions: ['vegan'], applyDiet: true });
    const snap = JSON.stringify({ recipes, pantry, r: c.restrictions });
    const one = rankRecipes(recipes, pantry, c);
    const two = rankRecipes(recipes, pantry, c);
    expect(JSON.stringify({ recipes, pantry, r: c.restrictions })).toBe(snap);
    expect(two).toEqual(one);
  });
});
