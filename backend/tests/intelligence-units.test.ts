import { toDec } from '../src/modules/intelligence/quantity';
import {
  resolveUnit,
  familyKey,
  toBase,
  fromBase,
  toDisplay,
  UnitFamily,
} from '../src/modules/intelligence/units';

const base = (qty: number, unit: string) => toBase(toDec(qty), resolveUnit(unit));

describe('resolveUnit aliases', () => {
  it.each([
    ['Tbsp', 'volume', 'tbsp'],
    ['tablespoons', 'volume', 'tbsp'],
    ['TBS', 'volume', 'tbsp'],
    ['cup', 'volume', 'cups'],
    ['fl. oz', 'volume', 'fl_oz'],
    ['fl oz', 'volume', 'fl_oz'],
    ['L', 'volume', 'liters'],
    ['lb', 'mass', 'lbs'],
    ['pounds', 'mass', 'lbs'],
    ['g', 'mass', 'grams'],
    ['gram', 'mass', 'grams'],
    ['', 'count', 'pieces'],
    ['pcs', 'count', 'pieces'],
    ['items', 'count', 'pieces'],
    ['piece', 'count', 'pieces'],
    ['clove', 'count', 'clove'],
    ['cloves', 'count', 'clove'],
    ['Cans', 'count', 'can'],
  ])('%p -> %s/%s', (raw, family, key) => {
    const r = resolveUnit(raw);
    expect(r.family).toBe(family);
    expect(r.unitKey).toBe(key);
  });

  it('is total on null/undefined and keeps free-text label', () => {
    expect(resolveUnit(null).unitKey).toBe('pieces');
    expect(resolveUnit(undefined).family).toBe('count');
    expect(resolveUnit('Cans').label).toBe('Cans');
    expect(resolveUnit('c').family).toBe('count');
  });
});

describe('exact conversion', () => {
  it.each([
    [16, 'tbsp', 1, 'cups'],
    [3, 'tsp', 1, 'tbsp'],
    [48, 'tsp', 1, 'cups'],
    [8, 'fl_oz', 1, 'cups'],
    [16, 'oz', 1, 'lbs'],
    [1000, 'grams', 1, 'kg'],
    [1, 'lbs', 453.59237, 'grams'],
  ])('%p %s == %p %s', (q1, u1, q2, u2) => {
    expect(base(q1, u1).eq(base(q2, u2))).toBe(true);
  });

  it('16 tbsp == 1 cups through fromBase', () => {
    expect(fromBase(base(16, 'tbsp'), 'cups').eq(1)).toBe(true);
  });

  it('count units are identity', () => {
    expect(base(3, 'clove').eq(3)).toBe(true);
    expect(fromBase(toDec(3), 'clove').eq(3)).toBe(true);
  });
});

describe('familyKey', () => {
  it.each([
    ['grams', 'mass'],
    ['kg', 'mass'],
    ['cups', 'volume'],
    ['ml', 'volume'],
    ['pieces', 'count:pieces'],
    ['clove', 'count:clove'],
  ])('%s -> %s', (unit, key) => {
    expect(familyKey(resolveUnit(unit))).toBe(key);
  });

  it('mass, volume and count keys all differ', () => {
    const keys = ['grams', 'ml', 'pieces', 'clove'].map((u) => familyKey(resolveUnit(u)));
    expect(new Set(keys).size).toBe(4);
  });
});

describe('toDisplay ladder', () => {
  const show = (family: UnitFamily, qty: number, unit: string, inputs: string[]) => {
    const r = toDisplay({
      family,
      countLabel: 'pieces',
      baseTotal: base(qty, unit),
      inputUnitKeys: inputs,
    });
    return [r.unit, r.quantity.toDecimalPlaces(4).toNumber()];
  };

  it.each([
    ['mass', 1500, 'grams', ['grams', 'kg'], 'kg', 1.5],
    ['mass', 999, 'grams', ['grams', 'kg'], 'grams', 999],
    ['mass', 2000, 'grams', ['grams'], 'kg', 2],
    ['mass', 20, 'oz', ['oz', 'lbs'], 'lbs', 1.25],
    ['mass', 0.001, 'grams', ['grams'], 'grams', 0.001],
    ['mass', 8, 'oz', ['oz'], 'oz', 8],
    ['mass', 100, 'grams', ['grams', 'oz'], 'grams', 100],
    ['volume', 3, 'tsp', ['tsp'], 'tbsp', 1],
    ['volume', 2, 'tsp', ['tsp'], 'tsp', 2],
    ['volume', 4, 'tbsp', ['tbsp'], 'cups', 0.25],
    ['volume', 300, 'ml', ['ml'], 'ml', 300],
    ['volume', 3000, 'ml', ['ml'], 'liters', 3],
    ['volume', 4, 'fl_oz', ['fl_oz'], 'fl_oz', 4],
    ['volume', 16, 'fl_oz', ['fl_oz'], 'cups', 2],
  ] as const)('%s %p %s %j -> %s %p', (family, qty, unit, inputs, outUnit, outQty) => {
    expect(show(family, qty, unit, [...inputs])).toEqual([outUnit, outQty]);
  });

  it('majority tie (grams + oz) -> metric', () => {
    const r = toDisplay({
      family: 'mass',
      countLabel: 'pieces',
      baseTotal: toDec(2000),
      inputUnitKeys: ['grams', 'oz'],
    });
    expect(r.unit).toBe('kg');
  });

  it('count family returns countLabel unchanged', () => {
    const r = toDisplay({
      family: 'count',
      countLabel: 'Cloves',
      baseTotal: toDec(7),
      inputUnitKeys: ['clove'],
    });
    expect(r.unit).toBe('Cloves');
    expect(r.quantity.eq(7)).toBe(true);
  });
});
