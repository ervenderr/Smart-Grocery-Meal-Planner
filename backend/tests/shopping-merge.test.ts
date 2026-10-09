import { mergeIntoItems, mergeKey } from '../src/modules/shopping/shopping.merge';
import { toDec } from '../src/modules/intelligence/quantity';
import type { ExistingItem } from '../src/modules/shopping/shopping.merge';

const existing = (over: Partial<ExistingItem> = {}): ExistingItem => ({
  id: 'i1',
  itemName: 'Milk',
  unit: 'liters',
  quantity: 1,
  isChecked: false,
  ...over,
});

describe('mergeKey', () => {
  it('ignores case and surrounding whitespace', () => {
    expect(mergeKey(' Milk ', 'Liters')).toBe(mergeKey('milk', 'liters'));
    // Phase 5: cups and liters share the volume family, so they now share a key
    expect(mergeKey('milk', 'cups')).toBe(mergeKey('milk', 'liters'));
    expect(mergeKey('milk', 'cups')).not.toBe(mergeKey('milk', 'pieces'));
    expect(mergeKey('Tomatoes', 'g')).toBe(mergeKey('tomato', 'kg'));
  });
});

describe('mergeIntoItems', () => {
  it('sums into an unchecked match', () => {
    const plan = mergeIntoItems([existing()], [{ itemName: 'milk', quantity: 2, unit: 'liters' }]);
    // Phase 5: updates carry the display unit
    expect(plan.updates).toEqual([{ id: 'i1', quantity: 3, unit: 'liters' }]);
    expect(plan.inserts).toEqual([]);
  });

  it('adds a new line when the match is checked', () => {
    const plan = mergeIntoItems(
      [existing({ isChecked: true })],
      [{ itemName: 'milk', quantity: 2, unit: 'liters' }],
    );
    expect(plan.updates).toEqual([]);
    expect(plan.inserts).toEqual([
      { itemName: 'milk', quantity: 2, unit: 'liters', category: 'dairy' },
    ]);
  });

  it('collapses duplicate incoming items', () => {
    const plan = mergeIntoItems([], [
      { itemName: 'Egg', quantity: 1, unit: 'pieces' },
      { itemName: 'egg', quantity: 2, unit: 'Pieces' },
    ]);
    expect(plan.inserts).toHaveLength(1);
    expect(plan.inserts[0]).toMatchObject({ itemName: 'Egg', quantity: 3, unit: 'pieces' });
  });

  it('sums in hundredths and clamps to the maximum', () => {
    expect(
      mergeIntoItems([existing({ quantity: 0.1 })], [{ itemName: 'Milk', quantity: 0.2, unit: 'liters' }])
        .updates[0],
    ).toMatchObject({ quantity: 300, unit: 'ml' }); // Phase 5: ladder, 300 ml < 1000 ml
    expect(
      mergeIntoItems([existing({ quantity: 99999 })], [{ itemName: 'Milk', quantity: 5, unit: 'liters' }])
        .updates[0],
    ).toMatchObject({ quantity: 99999, unit: 'liters' });
  });

  it('skips blank names and non-finite quantities, truncates long names and coerces units', () => {
    const plan = mergeIntoItems([], [
      { itemName: '   ', quantity: 1, unit: 'g' },
      { itemName: 'x'.repeat(150), quantity: 1, unit: '' },
      { itemName: 'Garlic', quantity: 1, unit: 'clove' },
      { itemName: 'Rice', quantity: NaN, unit: 'cup;drop' },
      { itemName: 'Beans', quantity: 2, unit: 'cup;drop' },
      { itemName: 'Salt', quantity: 0.001, unit: 'g' },
    ]);
    expect(plan.inserts).toHaveLength(4);
    expect(plan.inserts.map((i) => i.itemName)).not.toContain('Rice');
    expect(plan.inserts[0].itemName).toHaveLength(100);
    expect(plan.inserts[0].unit).toBe('pieces');
    expect(plan.inserts[1].unit).toBe('clove');
    expect(plan.inserts[2].quantity).toBe(2);
    expect(plan.inserts[2].unit).toMatch(/^[\p{L}\p{N} .%/-]{1,20}$/u);
    // Phase 5: tiny gram amounts display as grams at the 0.01 minimum
    expect(plan.inserts[3]).toMatchObject({ quantity: 0.01, unit: 'grams' });
  });

  it('does not mutate frozen inputs', () => {
    const ex = Object.freeze([Object.freeze(existing())]);
    const inc = Object.freeze([Object.freeze({ itemName: 'Milk', quantity: 1, unit: 'liters' })]);
    expect(() => mergeIntoItems(ex, inc)).not.toThrow();
    expect(ex[0].quantity).toBe(1);
  });

  it('only merges into the first unchecked match when checked and unchecked both exist', () => {
    const plan = mergeIntoItems(
      [existing({ id: 'c', isChecked: true }), existing({ id: 'u' })],
      [{ itemName: 'milk', quantity: 1, unit: 'liters' }],
    );
    expect(plan.updates).toEqual([{ id: 'u', quantity: 2, unit: 'liters' }]); // Phase 5: unit carried
  });
});

describe('mergeIntoItems zero and invalid quantities', () => {
  const bad = [0, -2, Number.NaN, Number.POSITIVE_INFINITY];

  it.each(bad)('skips an incoming line with quantity %p (no insert, no merge)', (quantity) => {
    const plan = mergeIntoItems([existing()], [{ itemName: 'milk', quantity, unit: 'liters' }]);
    expect(plan).toEqual({ updates: [], inserts: [] });
    expect(mergeIntoItems([], [{ itemName: 'salt', quantity, unit: 'tsp' }])).toEqual({
      updates: [],
      inserts: [],
    });
  });

  it('does not add 1 to an existing line for a zero-quantity ingredient', () => {
    const plan = mergeIntoItems(
      [existing({ quantity: 2 })],
      [
        { itemName: 'Milk', quantity: 0, unit: 'liters' },
        { itemName: 'Milk', quantity: 1, unit: 'liters' },
      ],
    );
    expect(plan.updates).toEqual([{ id: 'i1', quantity: 3, unit: 'liters' }]); // Phase 5: unit carried
  });

  it('keeps tiny positive quantities at the 0.01 minimum', () => {
    const plan = mergeIntoItems([], [{ itemName: 'saffron', quantity: 0.001, unit: 'grams' }]);
    expect(plan.inserts[0].quantity).toBe(0.01);
  });
});

describe('mergeIntoItems canonical unit-aware merge', () => {
  const flour = (over: Partial<ExistingItem> = {}) =>
    existing({ id: 'f', itemName: 'Flour', unit: 'grams', quantity: 500, ...over });

  it('converts within a family and updates quantity and unit', () => {
    const plan = mergeIntoItems([flour()], [{ itemName: 'flour', quantity: 1, unit: 'kg' }]);
    expect(plan.updates).toEqual([{ id: 'f', quantity: 1.5, unit: 'kg' }]);
    expect(plan.inserts).toEqual([]);
  });

  it('merges plural names and tbsp into cups', () => {
    const plan = mergeIntoItems(
      [flour({ quantity: 1, unit: 'cups' })],
      [{ itemName: 'flours', quantity: 16, unit: 'tbsp' }],
    );
    expect(plan.updates).toEqual([{ id: 'f', quantity: 2, unit: 'cups' }]);
  });

  it('does not merge volume with count', () => {
    const plan = mergeIntoItems([existing({ unit: 'cups' })], [{ itemName: 'milk', quantity: 2, unit: 'pieces' }]);
    expect(plan.updates).toEqual([]);
    expect(plan.inserts).toHaveLength(1);
  });

  it('does not merge different count words', () => {
    const plan = mergeIntoItems(
      [existing({ itemName: 'Garlic', unit: 'clove' })],
      [{ itemName: 'garlic', quantity: 3, unit: 'pieces' }],
    );
    expect(plan.updates).toEqual([]);
    expect(plan.inserts).toHaveLength(1);
  });

  it('accepts Dec quantities and sums thirds exactly', () => {
    const third = toDec(1).div(3);
    const plan = mergeIntoItems([], [
      { itemName: 'sugar', quantity: third, unit: 'cups' },
      { itemName: 'sugar', quantity: third, unit: 'cups' },
      { itemName: 'sugar', quantity: third, unit: 'cups' },
    ]);
    expect(plan.inserts).toHaveLength(1);
    expect(plan.inserts[0]).toMatchObject({ quantity: 1, unit: 'cups' });
  });

  it('never touches a checked match and inserts a new line instead', () => {
    const plan = mergeIntoItems(
      [flour({ isChecked: true, quantity: 1, unit: 'kg' })],
      [{ itemName: 'flour', quantity: 500, unit: 'grams' }],
    );
    expect(plan.updates).toEqual([]);
    expect(plan.inserts).toEqual([
      expect.objectContaining({ itemName: 'flour', quantity: 500, unit: 'grams' }),
    ]);
  });
});
