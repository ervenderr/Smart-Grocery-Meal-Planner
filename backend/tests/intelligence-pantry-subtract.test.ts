import {
  groupIngredients,
  displayOf,
  IngredientLine,
} from '../src/modules/intelligence/merge-groups';
import { PantryStockItem, subtractPantry } from '../src/modules/intelligence/pantry-subtract';
import { finalizeQuantity, toDec } from '../src/modules/intelligence/quantity';

const TODAY = new Date(Date.UTC(2026, 9, 9));
const need = (name: string, q: number, unit: string) =>
  groupIngredients([{ name, quantity: toDec(q), unit }]);
const lot = (
  ingredientName: string,
  quantity: unknown,
  unit: string,
  expiryDate: Date | null = null,
): PantryStockItem => ({ ingredientName, quantity, unit, expiryDate });

describe('subtractPantry', () => {
  it.each([
    ['grams vs kg stock', need('rice', 500, 'grams'), [lot('rice', 1, 'kg')], 'rice', 500, 1000, 'grams'],
    ['cups vs tbsp stock', need('milk', 1, 'cups'), [lot('milk', 16, 'tbsp')], 'milk', 1, 1, 'cups'],
    [
      'two lots summed',
      need('rice', 500, 'grams'),
      [lot('rice', 200, 'grams'), lot('rice', '300', 'grams')],
      'rice', 500, 500, 'grams',
    ],
    ['name plural match', need('tomato', 2, 'pieces'), [lot('Tomatoes', 5, 'pieces')], 'tomato', 2, 5, 'pieces'],
  ])('full: %s', (_l, groups, pantry, name, needed, have, unit) => {
    const r = subtractPantry(groups, pantry, TODAY);
    expect(r.remaining).toEqual([]);
    expect(r.covered).toEqual([{ name, needed, have, unit, status: 'full' }]);
  });

  it('partial keeps only the missing amount', () => {
    const r = subtractPantry(need('flour', 1, 'kg'), [lot('flour', 400, 'grams')], TODAY);
    expect(r.remaining).toHaveLength(1);
    expect(r.remaining[0].baseTotal.toString()).toBe('600');
    const d = displayOf(r.remaining[0]);
    expect(d.unit).toBe('grams');
    expect(d.quantity.toNumber()).toBe(600);
    expect(r.covered).toEqual([
      { name: 'flour', needed: 1, have: 0.4, unit: 'kg', status: 'partial' },
    ]);
  });

  it('exact third vs 0.33 cups is full via epsilon', () => {
    const third: IngredientLine = { name: 'oil', quantity: toDec(1).div(3), unit: 'cups' };
    const r = subtractPantry(groupIngredients([third]), [lot('oil', 0.33, 'cups')], TODAY);
    expect(r.remaining).toEqual([]);
    expect(r.covered[0].status).toBe('full');
    expect(finalizeQuantity(toDec(0))).toBeGreaterThan(0);
  });

  it.each([
    ['expired yesterday ignored', new Date(Date.UTC(2026, 9, 8)), 1, 0],
    ['expiring today counts', new Date(Date.UTC(2026, 9, 9)), 0, 1],
    ['expiring today later hour counts', new Date(Date.UTC(2026, 9, 9, 15)), 0, 1],
    ['no expiry counts', null, 0, 1],
  ])('%s', (_l, expiry, remainingCount, coveredCount) => {
    const r = subtractPantry(need('rice', 100, 'grams'), [lot('rice', 500, 'grams', expiry)], TODAY);
    expect(r.remaining).toHaveLength(remainingCount);
    expect(r.covered).toHaveLength(coveredCount);
  });

  it('incompatible unit keeps full need and flags it', () => {
    const r = subtractPantry(need('milk', 2, 'cups'), [lot('milk', 1, 'pieces')], TODAY);
    expect(r.remaining).toHaveLength(1);
    expect(r.remaining[0].baseTotal.toNumber()).toBeCloseTo(2 * 236.5882365, 6);
    expect(r.covered).toEqual([
      { name: 'milk', needed: 2, have: 1, unit: 'cups', status: 'incompatible', haveUnit: 'pieces' },
    ]);
  });

  it.each([
    ['zero quantity', 0],
    ['unparseable', 'abc'],
    ['null', null],
    ['negative', -3],
  ])('ignores pantry quantity: %s', (_l, q) => {
    const groups = need('rice', 100, 'grams');
    const r = subtractPantry(groups, [lot('rice', q, 'grams')], TODAY);
    expect(r.remaining).toEqual(groups);
    expect(r.covered).toEqual([]);
  });

  it('empty pantry returns input groups', () => {
    const groups = need('rice', 100, 'grams');
    const r = subtractPantry(groups, [], TODAY);
    expect(r.remaining).toEqual(groups);
    expect(r.covered).toEqual([]);
  });

  it('does not mutate frozen inputs', () => {
    const groups = Object.freeze(need('rice', 100, 'grams'));
    const pantry = Object.freeze([Object.freeze(lot('rice', 40, 'grams'))]);
    expect(() => subtractPantry(groups, pantry, TODAY)).not.toThrow();
    expect(groups[0].baseTotal.toNumber()).toBe(100);
  });

  it('leaves unrelated groups untouched', () => {
    const groups = need('rice', 100, 'grams');
    const r = subtractPantry(groups, [lot('beans', 5, 'grams')], TODAY);
    expect(r.remaining).toEqual(groups);
    expect(r.covered).toEqual([]);
  });
});
