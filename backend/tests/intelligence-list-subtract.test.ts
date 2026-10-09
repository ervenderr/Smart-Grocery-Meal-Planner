import { groupIngredients } from '../src/modules/intelligence/merge-groups';
import { ListStockItem, subtractListStock } from '../src/modules/intelligence/list-subtract';
import { finalizeQuantity, toDec } from '../src/modules/intelligence/quantity';
import { displayOf } from '../src/modules/intelligence/merge-groups';

const need = (name: string, q: number, unit: string) =>
  groupIngredients([{ name, quantity: toDec(q), unit }]);
const item = (itemName: string, quantity: number, unit: string, isChecked = false): ListStockItem => ({
  itemName,
  quantity,
  unit,
  isChecked,
});

describe('subtractListStock (WR-05)', () => {
  it('fully covers a need already on the list', () => {
    const { remaining, covered } = subtractListStock(need('Onion', 3, 'pieces'), [item('onion', 3, 'pieces')]);
    expect(remaining).toHaveLength(0);
    expect(covered).toEqual([
      { name: 'Onion', needed: 3, have: 3, unit: 'pieces', status: 'on_list' },
    ]);
  });

  it('keeps only the shortfall, converting units exactly', () => {
    const { remaining, covered } = subtractListStock(need('Flour', 1, 'kg'), [item('flour', 400, 'grams')]);
    expect(remaining).toHaveLength(1);
    const shown = displayOf(remaining[0]);
    expect(finalizeQuantity(shown.quantity)).toBe(600);
    expect(shown.unit).toBe('grams');
    expect(covered[0]).toMatchObject({ status: 'on_list', needed: 1, have: 0.4, unit: 'kg' });
  });

  it('ignores checked items, other unit families and other names', () => {
    const groups = need('Milk', 1, 'liters');
    const { remaining, covered } = subtractListStock(groups, [
      item('milk', 5, 'liters', true),
      item('milk', 2, 'pieces'),
      item('almond milk', 9, 'liters'),
    ]);
    expect(remaining).toHaveLength(1);
    expect(covered).toEqual([]);
  });

  it('treats 2dp storage drift as covered', () => {
    const groups = need('Flour', 1 / 3, 'cups');
    const { remaining } = subtractListStock(groups, [item('flour', 0.33, 'cups')]);
    expect(remaining).toHaveLength(0);
  });

  it('does not mutate its inputs', () => {
    const groups = Object.freeze(need('Onion', 3, 'pieces'));
    const list = Object.freeze([Object.freeze(item('onion', 1, 'pieces'))]);
    expect(() => subtractListStock(groups, list)).not.toThrow();
    expect(groups).toHaveLength(1);
  });
});
