/**
 * Pure cook planner (06-03): scaling, unit families, FEFO allocation.
 */

import {
  CookLot,
  allocateDeduction,
  computeCookPlan,
  cookKey,
} from '../src/modules/cook/cook.plan';

const TODAY = new Date('2026-10-09T00:00:00.000Z');

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as object).forEach(deepFreeze);
  }
  return value;
};

let seq = 0;
const lot = (
  name: string,
  quantity: number,
  unit: string,
  expiry: string | null = null,
  extra: Partial<CookLot> = {},
): CookLot =>
  deepFreeze({
    id: `lot-${(seq += 1)}`,
    ingredientName: name,
    quantity,
    unit,
    expiryDate: expiry ? new Date(`${expiry}T00:00:00.000Z`) : null,
    createdAt: new Date(`2026-09-${String(10 + seq).padStart(2, '0')}T00:00:00.000Z`),
    ...extra,
  });

const recipe = (
  servings: number,
  ingredients: ReadonlyArray<{ ingredientName: string; quantity: number; unit: string }>,
) => deepFreeze({ servings, title: 'Test', ingredientsList: ingredients.map((i) => ({ ...i })) });

const plan = (
  r: ReturnType<typeof recipe>,
  lots: readonly CookLot[],
  servings = r.servings,
  staples: string[] = [],
) =>
  computeCookPlan({ recipe: r, servings, lots, staples: new Set(staples), todayUtc: TODAY });

describe('computeCookPlan', () => {
  it('scales by servings', () => {
    const p = plan(recipe(2, [{ ingredientName: 'eggs', quantity: 4, unit: 'pieces' }]), [lot('Eggs', 12, 'pieces')], 1);
    expect(p.rows).toHaveLength(1);
    expect(p.rows[0]).toMatchObject({ use: 2, have: 12, left: 10, status: 'ok' });
  });

  it.each([
    ['grams vs kg', 'flour', 200, 'grams', lot('flour', 1, 'kg'), 'kg', 1, 0.2, 0.8],
    ['tbsp vs cups', 'sugar', 4, 'tbsp', lot('sugar', 1, 'cups'), 'cups', 1, 0.25, 0.75],
    ['cups vs liters', 'milk', 2, 'cups', lot('milk', 1, 'liters'), 'liters', 1, 0.47, 0.53],
  ])('converts within a family: %s', (_l, name, q, unit, stock, rowUnit, have, use, left) => {
    const p = plan(recipe(1, [{ ingredientName: name, quantity: q, unit }]), [stock]);
    expect(p.rows[0]).toMatchObject({ unit: rowUnit, have, use, left, status: 'ok' });
  });

  it('merges lots of one key into a single FEFO-unit row', () => {
    const lots = [lot('Rice', 1, 'kg'), lot('Rice', 500, 'grams', '2026-10-10')];
    const p = plan(recipe(1, [{ ingredientName: 'rice', quantity: 700, unit: 'grams' }]), lots);
    expect(p.rows).toHaveLength(1);
    expect(p.rows[0]).toMatchObject({ unit: 'grams', have: 1500, use: 700, left: 800, status: 'ok' });
    expect(p.rows[0].name).toBe('Rice');
  });

  it('allocates 700 g across FEFO lots', () => {
    const lots = [lot('Rice', 1, 'kg'), lot('Rice', 500, 'grams', '2026-10-10')];
    const key = cookKey('rice', 'grams');
    const r = allocateDeduction({ lots, key, unit: 'grams', use: 700, todayUtc: TODAY });
    expect(r.updates).toEqual([
      { id: lots[1].id, quantity: 0 },
      { id: lots[0].id, quantity: 0.8 },
    ]);
    expect(r.usedUp).toBe(1);
  });

  it('ignores expired lots', () => {
    const lots = [lot('Rice', 500, 'grams', '2026-10-08'), lot('Rice', 100, 'grams')];
    const p = plan(recipe(1, [{ ingredientName: 'rice', quantity: 50, unit: 'grams' }]), lots);
    expect(p.rows[0]).toMatchObject({ have: 100, use: 50, left: 50 });
    const r = allocateDeduction({ lots, key: cookKey('rice', 'grams'), unit: 'grams', use: 500, todayUtc: TODAY });
    expect(r.updates).toEqual([{ id: lots[1].id, quantity: 0 }]);
  });

  it('flags short stock and uses only what is held', () => {
    const p = plan(recipe(1, [{ ingredientName: 'rice', quantity: 300, unit: 'grams' }]), [lot('Rice', 100, 'grams')]);
    expect(p.rows[0]).toMatchObject({ use: 100, left: 0, status: 'short' });
  });

  it('returns a mismatch row across unit families', () => {
    const p = plan(recipe(1, [{ ingredientName: 'milk', quantity: 2, unit: 'pieces' }]), [lot('Milk', 1, 'liters')]);
    expect(p.rows).toEqual([
      expect.objectContaining({
        status: 'mismatch',
        use: 0,
        have: 1,
        left: 1,
        unit: 'liters',
        recipeQuantity: 2,
        recipeUnit: 'pieces',
      }),
    ]);
    expect(p.notInPantry).toEqual([]);
  });

  it('lists ingredients missing from the pantry', () => {
    const p = plan(recipe(1, [{ ingredientName: 'saffron', quantity: 1, unit: 'grams' }]), [lot('Rice', 1, 'kg')]);
    expect(p.rows).toEqual([]);
    expect(p.notInPantry).toEqual(['saffron']);
  });

  it('lists staples without deducting them', () => {
    const p = plan(
      recipe(1, [{ ingredientName: 'salt', quantity: 1, unit: 'tsp' }]),
      [lot('Salt', 500, 'grams')],
      1,
      ['salt'],
    );
    expect(p.rows).toEqual([]);
    expect(p.staples).toEqual(['salt']);
  });

  it.each([[null], [undefined], ['x'], [[]], [[{ ingredientName: '', quantity: 1, unit: 'g' }]]])(
    'handles empty or malformed list %p',
    (list) => {
      const p = computeCookPlan({
        recipe: { servings: 2, title: 'T', ingredientsList: list },
        servings: 2,
        lots: [],
        staples: new Set(),
        todayUtc: TODAY,
      });
      expect(p.rows).toEqual([]);
      expect(p.ingredientCount).toBe(0);
    },
  );

  it('skips zero and non-numeric stock', () => {
    const lots = [lot('Rice', 0, 'grams'), lot('Rice', 'abc' as unknown as number, 'grams')];
    const p = plan(recipe(1, [{ ingredientName: 'rice', quantity: 50, unit: 'grams' }]), lots);
    expect(p.notInPantry).toEqual(['rice']);
  });
});

describe('allocateDeduction', () => {
  const lots = [lot('Oats', 300, 'grams', '2026-10-20'), lot('Oats', 200, 'grams'), lot('Beans', 5, 'pieces')];
  const key = cookKey('oats', 'grams');

  it('zeroes every lot when use exceeds stock', () => {
    const r = allocateDeduction({ lots, key, unit: 'grams', use: 99999, todayUtc: TODAY });
    expect(r.updates.map((u) => u.quantity)).toEqual([0, 0]);
    expect(r.usedUp).toBe(2);
  });

  it('returns no updates for zero use', () => {
    expect(allocateDeduction({ lots, key, unit: 'grams', use: 0, todayUtc: TODAY })).toEqual({ updates: [], usedUp: 0 });
  });

  it('leaves untouched lots out and never touches other keys', () => {
    const r = allocateDeduction({ lots, key, unit: 'grams', use: 100, todayUtc: TODAY });
    expect(r.updates).toEqual([{ id: lots[0].id, quantity: 200 }]);
  });

  it('throws when the unit family differs from the key', () => {
    expect(() => allocateDeduction({ lots, key, unit: 'pieces', use: 1, todayUtc: TODAY })).toThrow(/family/i);
  });

  it('returns nothing when no usable lots remain', () => {
    expect(allocateDeduction({ lots: [], key, unit: 'grams', use: 5, todayUtc: TODAY }).updates).toEqual([]);
  });

  it('accepts a different unit of the same family', () => {
    const r = allocateDeduction({ lots, key, unit: 'kg', use: 0.1, todayUtc: TODAY });
    expect(r.updates).toEqual([{ id: lots[0].id, quantity: 200 }]);
  });
});
