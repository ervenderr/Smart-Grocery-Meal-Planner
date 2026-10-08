import { describe, expect, it } from 'vitest';
import {
  centsToMajorString,
  currencyOptionLabel,
  currencySymbol,
  formatCurrency,
  formatCurrencyCompact,
  parseMajorToCents,
} from './format';
import { isSupportedCurrency } from './currencies';

describe('formatCurrency', () => {
  it('formats 2-decimal currencies', () => {
    expect(formatCurrency(123450, 'PHP')).toBe('₱1,234.50');
    expect(formatCurrency(123450, 'USD')).toBe('$1,234.50');
  });

  it('formats zero-decimal currencies with 0 digits', () => {
    expect(formatCurrency(123450, 'JPY')).toBe('¥1,235');
    expect(formatCurrency(123450, 'KRW')).toBe('₩1,235');
  });

  it('falls back to PHP for unknown or empty codes', () => {
    expect(formatCurrency(123450, 'XXX')).toBe(formatCurrency(123450, 'PHP'));
    expect(formatCurrency(123450, '')).toBe(formatCurrency(123450, 'PHP'));
  });

  it('defaults to PHP, handles zero and negatives', () => {
    expect(formatCurrency(0)).toBe('₱0.00');
    expect(formatCurrency(-123450, 'PHP')).toMatch(/^-/);
  });
});

describe('formatCurrencyCompact', () => {
  it('abbreviates large amounts', () => {
    expect(formatCurrencyCompact(1250000, 'PHP')).toBe('₱13K');
  });

  it('falls back to PHP for invalid codes', () => {
    expect(formatCurrencyCompact(1250000, 'nope')).toBe('₱13K');
  });
});

describe('symbols and labels', () => {
  it('derives symbols from Intl', () => {
    expect(currencySymbol('PHP')).toBe('₱');
    expect(currencySymbol('JPY')).toBe('¥');
  });

  it('builds option labels', () => {
    expect(currencyOptionLabel('PHP')).toBe('PHP - Philippine Peso (₱)');
  });
});

describe('parseMajorToCents', () => {
  it('parses valid input', () => {
    expect(parseMajorToCents('2000')).toBe(200000);
    expect(parseMajorToCents('12.345')).toBe(1235);
  });

  it('rejects invalid input', () => {
    expect(parseMajorToCents('')).toBeNull();
    expect(parseMajorToCents('abc')).toBeNull();
    expect(parseMajorToCents('-5')).toBeNull();
  });
});

describe('centsToMajorString', () => {
  it('renders major units for inputs', () => {
    expect(centsToMajorString(200000)).toBe('2000');
    expect(centsToMajorString(123450)).toBe('1234.5');
  });
});

describe('isSupportedCurrency', () => {
  it('is case-sensitive', () => {
    expect(isSupportedCurrency('jpy')).toBe(false);
    expect(isSupportedCurrency('JPY')).toBe(true);
  });
});
