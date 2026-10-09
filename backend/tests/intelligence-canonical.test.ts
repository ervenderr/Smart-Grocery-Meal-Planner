import { readFileSync } from 'fs';
import path from 'path';
import { canonicalName } from '../src/modules/intelligence/canonical';

const ROWS: ReadonlyArray<readonly [string, string]> = JSON.parse(
  readFileSync(path.join(__dirname, 'fixtures', 'canonical-cases.json'), 'utf8'),
);

describe('canonicalName', () => {
  it.each(ROWS)('%p -> %p', (input, expected) => {
    expect(canonicalName(input)).toBe(expected);
  });

  it('keeps distinct keys distinct', () => {
    expect(canonicalName('almond flour')).not.toBe(canonicalName('flour'));
    expect(canonicalName('Bell Peppers')).not.toBe(canonicalName('pepper'));
  });

  it('keeps qualifier-distinct ingredients distinct (CR-01)', () => {
    const names = [
      'Pepper, black', 'Pepper, red flakes', 'Oil, olive', 'Oil, sesame',
      'Sugar (brown)', 'Sugar (powdered)', 'Chicken, breast', 'Chicken, thigh',
    ].map(canonicalName);
    expect(new Set(names).size).toBe(names.length);
  });

  it('matches reordered category names (CR-01)', () => {
    expect(canonicalName('Pepper, black')).toBe(canonicalName('Black pepper'));
    expect(canonicalName('Oil, olive')).toBe(canonicalName('olive oil'));
    expect(canonicalName('Sugar (brown)')).toBe(canonicalName('Brown sugar'));
  });

  it.each([[123], [null], [undefined], [{}]])('non-string %p -> empty', (input) => {
    expect(canonicalName(input as unknown)).toBe('');
  });

  it('is idempotent for every row', () => {
    for (const [input] of ROWS) {
      const once = canonicalName(input);
      expect(canonicalName(once)).toBe(once);
    }
  });

  it('handles a 5000-char input in under 50 ms', () => {
    const start = Date.now();
    canonicalName('a '.repeat(2500));
    canonicalName('('.repeat(5000));
    expect(Date.now() - start).toBeLessThan(50);
  });
});
