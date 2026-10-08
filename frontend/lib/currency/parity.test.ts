import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SUPPORTED_CURRENCY_CODES } from './currencies';

describe('currency list parity with backend', () => {
  it('matches backend/src/constants/currencies.ts in order', () => {
    const file = path.resolve(__dirname, '../../../backend/src/constants/currencies.ts');
    const source = readFileSync(file, 'utf8');
    const codes = Array.from(source.matchAll(/'([A-Z]{3})'/g), (m) => m[1]);
    expect(codes.length).toBeGreaterThan(0);
    expect([...SUPPORTED_CURRENCY_CODES]).toEqual(codes);
  });
});
