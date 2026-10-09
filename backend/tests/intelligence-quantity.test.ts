import { Decimal } from '@prisma/client/runtime/library';
import {
  D,
  toDec,
  parseDec,
  round2,
  finalizeQuantity,
  ZERO,
} from '../src/modules/intelligence/quantity';

describe('intelligence quantity math', () => {
  it('adds without float drift', () => {
    expect(toDec(0.1).plus(toDec(0.2)).toString()).toBe('0.3');
  });

  it('three thirds sum to 1.00', () => {
    const third = toDec(1).div(3);
    expect(round2(third.plus(third).plus(third)).toFixed(2)).toBe('1.00');
  });

  it.each([
    [1.005, '1.01'],
    [2.675, '2.68'],
    [0.004, '0.00'],
    [0.005, '0.01'],
  ])('round2 half up %p -> %p', (input, expected) => {
    expect(round2(toDec(input)).toFixed(2)).toBe(expected);
  });

  it('scales servings multiply-before-divide', () => {
    expect(toDec(1.5).times(3).div(2).toString()).toBe('2.25');
    expect(round2(toDec(2).times(1).div(3).times(3)).toFixed(2)).toBe('2.00');
  });

  it('ZERO is zero and D is an instance factory', () => {
    expect(ZERO.isZero()).toBe(true);
    expect(new D('1.5').toString()).toBe('1.5');
  });

  it('toDec throws on non-finite input', () => {
    expect(() => toDec(NaN)).toThrow();
    expect(() => toDec(Infinity)).toThrow();
  });

  it.each([
    [2, '2'],
    ['2.50', '2.5'],
    [new Decimal('1.5'), '1.5'],
    [toDec('3.25'), '3.25'],
  ])('parseDec accepts %p', (input, expected) => {
    expect(parseDec(input)?.toString()).toBe(expected);
  });

  it.each([[NaN], [Infinity], ['abc'], [null], [undefined], [{}], [[]], ['']])(
    'parseDec rejects %p',
    (input) => {
      expect(parseDec(input)).toBeNull();
    },
  );

  it.each([
    [0.001, 0.01],
    [100000, 99999],
    [1.234, 1.23],
  ])('finalizeQuantity %p -> %p', (input, expected) => {
    expect(finalizeQuantity(toDec(input))).toBe(expected);
  });

  it('never mutates the shared Prisma Decimal config', () => {
    toDec(1).div(3).plus(toDec(0.1));
    expect(Decimal.precision).toBe(20);
  });
});
