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
    expect(parseMajorToCents('12.34')).toBe(1234);
    expect(parseMajorToCents('12.5')).toBe(1250);
    expect(parseMajorToCents('0')).toBe(0);
    expect(parseMajorToCents('  7 ')).toBe(700);
  });

  it('avoids float rounding errors', () => {
    expect(parseMajorToCents('0.29')).toBe(29);
    expect(parseMajorToCents('1.15')).toBe(115);
    expect(parseMajorToCents('19.99')).toBe(1999);
    expect(parseMajorToCents('8.2')).toBe(820);
  });

  it('rejects more decimals than the currency allows', () => {
    expect(parseMajorToCents('1.005')).toBeNull();
    expect(parseMajorToCents('12.345')).toBeNull();
    expect(parseMajorToCents('0.1000')).toBeNull();
  });

  it('honours zero-decimal currencies', () => {
    expect(parseMajorToCents('1500', 'JPY')).toBe(150000);
    expect(parseMajorToCents('1500.5', 'JPY')).toBeNull();
    expect(parseMajorToCents('9000', 'KRW')).toBe(900000);
    expect(parseMajorToCents('9000.0', 'KRW')).toBeNull();
  });

  it('rejects hex, exponent, binary and separators', () => {
    expect(parseMajorToCents('0x1F')).toBeNull();
    expect(parseMajorToCents('1e3')).toBeNull();
    expect(parseMajorToCents('1E3')).toBeNull();
    expect(parseMajorToCents('0b11')).toBeNull();
    expect(parseMajorToCents('1_000')).toBeNull();
    expect(parseMajorToCents('1,000')).toBeNull();
    expect(parseMajorToCents('12,5')).toBeNull();
    expect(parseMajorToCents('1 000')).toBeNull();
    expect(parseMajorToCents('Infinity')).toBeNull();
    expect(parseMajorToCents('NaN')).toBeNull();
  });

  it('rejects empty, negative, signed and malformed input', () => {
    expect(parseMajorToCents('')).toBeNull();
    expect(parseMajorToCents('   ')).toBeNull();
    expect(parseMajorToCents('abc')).toBeNull();
    expect(parseMajorToCents('-5')).toBeNull();
    expect(parseMajorToCents('+5')).toBeNull();
    expect(parseMajorToCents('.5')).toBeNull();
    expect(parseMajorToCents('5.')).toBeNull();
    expect(parseMajorToCents('1.2.3')).toBeNull();
  });

  it('rejects absurdly large values', () => {
    expect(parseMajorToCents('9'.repeat(16))).toBeNull();
    expect(parseMajorToCents('99999999999')).toBe(9999999999900);
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
