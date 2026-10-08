import { mergeIntoItems, mergeKey } from '../src/modules/shopping/shopping.merge';
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
    expect(mergeKey('milk', 'cups')).not.toBe(mergeKey('milk', 'liters'));
  });
});

describe('mergeIntoItems', () => {
  it('sums into an unchecked match', () => {
    const plan = mergeIntoItems([existing()], [{ itemName: 'milk', quantity: 2, unit: 'liters' }]);
    expect(plan.updates).toEqual([{ id: 'i1', quantity: 3 }]);
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
        .updates[0].quantity,
    ).toBe(0.3);
    expect(
      mergeIntoItems([existing({ quantity: 99999 })], [{ itemName: 'Milk', quantity: 5, unit: 'liters' }])
        .updates[0].quantity,
    ).toBe(99999);
  });

  it('skips blank names, truncates long ones and coerces units and quantities', () => {
    const plan = mergeIntoItems([], [
      { itemName: '   ', quantity: 1, unit: 'g' },
      { itemName: 'x'.repeat(150), quantity: 1, unit: '' },
      { itemName: 'Garlic', quantity: 1, unit: 'clove' },
      { itemName: 'Rice', quantity: NaN, unit: 'cup;drop' },
      { itemName: 'Salt', quantity: 0.001, unit: 'g' },
    ]);
    expect(plan.inserts).toHaveLength(4);
    expect(plan.inserts[0].itemName).toHaveLength(100);
    expect(plan.inserts[0].unit).toBe('pieces');
    expect(plan.inserts[1].unit).toBe('clove');
    expect(plan.inserts[2].quantity).toBe(1);
    expect(plan.inserts[2].unit).toMatch(/^[\p{L}\p{N} .%/-]{1,20}$/u);
    expect(plan.inserts[3].quantity).toBe(0.01);
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
    expect(plan.updates).toEqual([{ id: 'u', quantity: 2 }]);
  });
});
