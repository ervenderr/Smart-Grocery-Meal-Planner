import { describe, expect, it } from 'vitest';
import { isValidBarcode, normalizeBarcode } from './barcode';

describe('normalizeBarcode', () => {
  it('pads UPC-A (12 digits) to EAN-13', () => {
    expect(normalizeBarcode('036000291452')).toBe('0036000291452');
  });
  it('leaves EAN-13 unchanged', () => {
    expect(normalizeBarcode('4800016644801')).toBe('4800016644801');
  });
  it('strips non-digits', () => {
    expect(normalizeBarcode(' 4800-0166 44801 ')).toBe('4800016644801');
  });
  it('leaves EAN-8, UPC-E and 14-digit codes unchanged', () => {
    expect(normalizeBarcode('96385074')).toBe('96385074');
    expect(normalizeBarcode('01234565')).toBe('01234565');
    expect(normalizeBarcode('12345678901234')).toBe('12345678901234');
  });
});

describe('isValidBarcode', () => {
  it('accepts 8, 13 and 14 digits', () => {
    expect(isValidBarcode('96385074')).toBe(true);
    expect(isValidBarcode('4800016644801')).toBe(true);
    expect(isValidBarcode('12345678901234')).toBe(true);
  });
  it('rejects 7 and 15 digits, empty and letters', () => {
    expect(isValidBarcode('1234567')).toBe(false);
    expect(isValidBarcode('123456789012345')).toBe(false);
    expect(isValidBarcode('')).toBe(false);
    expect(isValidBarcode('abc')).toBe(false);
  });
});
