import { normalizeUnit, coerceUnit } from '../src/modules/shopping/shopping.units';

describe('normalizeUnit', () => {
  it.each([
    ['Pieces', 'pieces'],
    [' KG ', 'kg'],
    ['pcs', 'pieces'],
    ['pc', 'pieces'],
    ['piece', 'pieces'],
    ['clove', 'clove'],
    ['fl oz', 'fl oz'],
    ['1/2 cup', '1/2 cup'],
    ['50%', '50%'],
    ['fl   oz', 'fl oz'],
  ])('%j -> %j', (raw, expected) => {
    expect(normalizeUnit(raw)).toBe(expected);
  });

  it.each([[''], ['   '], ['a'.repeat(21)], ['<b>'], ['cup;drop']])(
    '%j -> null',
    (raw) => {
      expect(normalizeUnit(raw)).toBeNull();
    },
  );

  it('accepts exactly 20 chars', () => {
    expect(normalizeUnit('a'.repeat(20))).toBe('a'.repeat(20));
  });
});

describe('coerceUnit', () => {
  it('returns normalized valid units', () => {
    expect(coerceUnit('PCS')).toBe('pieces');
    expect(coerceUnit('clove')).toBe('clove');
  });
  it('strips disallowed characters and collapses whitespace', () => {
    expect(coerceUnit('<b>cup</b>;  big')).toBe('bcup/b big');
  });
  it('truncates to 20 chars', () => {
    expect(coerceUnit('a'.repeat(30))).toHaveLength(20);
  });
  it('falls back to pieces when blank', () => {
    expect(coerceUnit('')).toBe('pieces');
    expect(coerceUnit('<>;;')).toBe('pieces');
  });
});
