import { describe, expect, it } from 'vitest';
import {
  MAX_QUANTITY,
  clampQuantity,
  formatQuantity,
  parseQuantityInput,
  sortUsedUpLast,
  stepForUnit,
  stepQuantity,
} from './quantity';

describe('stepForUnit', () => {
  it('returns unit-aware steps for stored units', () => {
    expect(stepForUnit('grams')).toBe(50);
    expect(stepForUnit('kg')).toBe(0.25);
    expect(stepForUnit('ml')).toBe(50);
    expect(stepForUnit('liters')).toBe(0.25);
    expect(stepForUnit('pieces')).toBe(1);
    expect(stepForUnit('items')).toBe(1);
    expect(stepForUnit('cups')).toBe(0.25);
    expect(stepForUnit('lbs')).toBe(0.25);
    expect(stepForUnit('tbsp')).toBe(1);
    expect(stepForUnit('fl_oz')).toBe(1);
  });

  it('is tolerant of aliases and unknown units', () => {
    expect(stepForUnit('g')).toBe(50);
    expect(stepForUnit('l')).toBe(0.25);
    expect(stepForUnit('cup')).toBe(0.25);
    expect(stepForUnit('pcs')).toBe(1);
    expect(stepForUnit('can')).toBe(1);
    expect(stepForUnit('')).toBe(1);
  });
});

describe('stepQuantity', () => {
  it('steps up and down by the unit step', () => {
    expect(stepQuantity(0.75, 'kg', 1)).toBe(1);
  });

  it('never goes negative', () => {
    expect(stepQuantity(0.1, 'kg', -1)).toBe(0);
  });

  it('caps at MAX_QUANTITY', () => {
    expect(MAX_QUANTITY).toBe(99999);
    expect(stepQuantity(99990, 'grams', 1)).toBe(99999);
  });

  it('does not accumulate float error', () => {
    let v = 0;
    for (let i = 0; i < 10; i += 1) v = stepQuantity(v, 'kg', 1);
    expect(v).toBe(2.5);
  });
});

describe('clampQuantity', () => {
  it('handles non-finite, negative and oversize values', () => {
    expect(clampQuantity(NaN)).toBe(0);
    expect(clampQuantity(-3)).toBe(0);
    expect(clampQuantity(123456)).toBe(99999);
  });

  it('rounds to 2 decimals', () => {
    expect(clampQuantity(1.005)).toBe(Math.round(1.005 * 100) / 100);
  });
});

describe('formatQuantity', () => {
  it('trims trailing zeros', () => {
    expect(formatQuantity(250)).toBe('250');
    expect(formatQuantity(0.25)).toBe('0.25');
    expect(formatQuantity(1.5)).toBe('1.5');
    expect(formatQuantity(2)).toBe('2');
  });
});

describe('parseQuantityInput', () => {
  it('parses valid numbers', () => {
    expect(parseQuantityInput('3')).toEqual({ ok: true, value: 3 });
    expect(parseQuantityInput(' 4 ')).toEqual({ ok: true, value: 4 });
  });

  it('reports errors', () => {
    expect(parseQuantityInput('')).toEqual({ ok: false, error: 'invalid' });
    expect(parseQuantityInput('abc')).toEqual({ ok: false, error: 'invalid' });
    expect(parseQuantityInput('2,5')).toEqual({ ok: false, error: 'invalid' });
    expect(parseQuantityInput('-1')).toEqual({ ok: false, error: 'negative' });
    expect(parseQuantityInput('100000')).toEqual({ ok: false, error: 'too_large' });
  });
});

describe('sortUsedUpLast', () => {
  it('moves zero quantities last, stably, without mutating', () => {
    const input = [
      { id: 'a', quantity: 0 },
      { id: 'b', quantity: '2' },
      { id: 'c', quantity: '0' },
      { id: 'd', quantity: 1 },
    ];
    const snapshot = [...input];
    const out = sortUsedUpLast(input);
    expect(out.map((i) => i.id)).toEqual(['b', 'd', 'a', 'c']);
    expect(input).toEqual(snapshot);
    expect(out).not.toBe(input);
  });
});
