import { describe, it, expect } from 'vitest';
import { formatAmount, unitLabel, FRACTION_TOLERANCE } from './format-amount';

describe('formatAmount', () => {
  it('uses kitchen fractions for volume units', () => {
    expect(formatAmount(0.75, 'cups')).toBe('3/4');
    expect(formatAmount(1.5, 'cups')).toBe('1 1/2');
    expect(formatAmount(0.333, 'tbsp')).toBe('1/3');
    expect(formatAmount(0.667, 'tsp')).toBe('2/3');
    expect(formatAmount(0.25, 'fl_oz')).toBe('1/4');
    expect(formatAmount(2, 'tsp')).toBe('2');
  });

  it('uses fractions for pieces', () => {
    expect(formatAmount(0.5, 'pieces')).toBe('1/2');
  });

  it('does not use fractions for mass or metric volume', () => {
    expect(formatAmount(0.75, 'grams')).toBe('0.75');
    expect(formatAmount(123.456, 'ml')).toBe('123.46');
  });

  it('snaps within tolerance and rounds otherwise', () => {
    expect(FRACTION_TOLERANCE).toBe(0.02);
    expect(formatAmount(0.76, 'cups')).toBe('3/4');
    expect(formatAmount(0.8, 'cups')).toBe('0.8');
    expect(formatAmount(1.99, 'cups')).toBe('2');
  });

  it('returns 0 for non-finite or negative input', () => {
    expect(formatAmount(Number.NaN, 'cups')).toBe('0');
    expect(formatAmount(Infinity, 'cups')).toBe('0');
    expect(formatAmount(-1, 'cups')).toBe('0');
  });
});

describe('unitLabel', () => {
  it('singular and plural labels', () => {
    expect(unitLabel('cups', 1)).toBe('cup');
    expect(unitLabel('cups', 2)).toBe('cups');
    expect(unitLabel('grams', 5)).toBe('g');
    expect(unitLabel('liters', 1)).toBe('liter');
    expect(unitLabel('pieces', 2)).toBe('');
    expect(unitLabel('fl_oz', 1)).toBe('fl oz');
    expect(unitLabel('tbsp', 2)).toBe('tbsp');
  });
});
