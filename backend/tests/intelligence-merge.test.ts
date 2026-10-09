import { groupIngredients, groupKey, displayOf, IngredientLine } from '../src/modules/intelligence/merge-groups';
import { toDec, finalizeQuantity } from '../src/modules/intelligence/quantity';

const line = (name: string, q: number | string, unit: string, source?: string): IngredientLine => ({
  name,
  quantity: toDec(q),
  unit,
  source,
});

describe('groupIngredients', () => {
  it('sums same name and family exactly and displays with the ladder', () => {
    const groups = groupIngredients([line('flour', 500, 'grams'), line('Flour', 1, 'kg')]);
    expect(groups).toHaveLength(1);
    expect(groups[0].baseTotal.toString()).toBe('1500');
    expect(groups[0].displayName).toBe('flour');
    const d = displayOf(groups[0]);
    expect(d.unit).toBe('kg');
    expect(d.quantity.toNumber()).toBe(1.5);
  });

  it.each([
    ['plural names merge', [line('Flour', 1, 'cups'), line('flours', 1, 'cups')], 1],
    ['volume vs count separate', [line('milk', 1, 'cups'), line('milk', 2, 'pieces')], 2],
    ['cloves vs pieces separate', [line('garlic', 1, 'cloves'), line('garlic', 3, 'pieces')], 2],
    ['pieces == items', [line('eggs', 2, 'pieces'), line('eggs', 3, 'items')], 1],
    ['zero skipped', [line('salt', 0, 'tsp')], 0],
    ['negative skipped', [line('salt', -1, 'tsp')], 0],
    ['empty name skipped', [line('', 1, 'tsp')], 0],
    ['punctuation name skipped', [line('!!!', 1, 'tsp')], 0],
  ] as const)('%s', (_label, lines, count) => {
    expect(groupIngredients(lines)).toHaveLength(count);
  });

  it('thirds sum displays as 1 cups without 0.99', () => {
    const third = toDec(1).div(3);
    const l = (): IngredientLine => ({ name: 'sugar', quantity: third, unit: 'cups' });
    const g = groupIngredients([l(), l(), l()]);
    const d = displayOf(g[0]);
    expect(d.unit).toBe('cups');
    expect(finalizeQuantity(d.quantity)).toBe(1);
  });

  it.each([
    ['salt', 3, 'tsp', 1, 'tbsp'],
    ['rice', 2000, 'grams', 2, 'kg'],
  ])('ladder applies to single-unit group %s', (name, q, unit, expQ, expUnit) => {
    const d = displayOf(groupIngredients([line(name, q, unit)])[0]);
    expect(d.unit).toBe(expUnit);
    expect(d.quantity.toNumber()).toBe(expQ);
  });

  it('collects distinct ordered sources and unit keys', () => {
    const g = groupIngredients([
      line('pasta', 1, 'cups', 'Pasta'),
      line('pasta', 1, 'cups', 'Pasta'),
      line('pasta', 1, 'tbsp', 'Salad'),
      line('pasta', 1, 'tbsp'),
    ]);
    expect(g[0].sources).toEqual(['Pasta', 'Salad']);
    expect(g[0].inputUnitKeys).toEqual(['cups', 'tbsp']);
  });

  it('collapses whitespace in display name and does not mutate inputs', () => {
    const input = Object.freeze([Object.freeze(line('  Olive   Oil ', 1, 'tbsp'))]);
    const g = groupIngredients(input);
    expect(g[0].displayName).toBe('Olive Oil');
    expect(input[0].name).toBe('  Olive   Oil ');
  });

  it('keeps first-seen count label', () => {
    const g = groupIngredients([line('garlic', 1, 'cloves'), line('garlic', 2, 'clove')]);
    expect(g).toHaveLength(1);
    expect(g[0].countLabel).toBe('cloves');
  });
});

describe('groupKey', () => {
  it('matches across names and mass units', () => {
    expect(groupKey('Tomatoes', 'g')).toBe(groupKey('tomato', 'kg'));
  });
  it('differs across families', () => {
    expect(groupKey('milk', 'cups')).not.toBe(groupKey('milk', 'pieces'));
  });
});
