import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { canonicalName } from './canonical';

const ROWS: Array<[string, string]> = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../../../backend/tests/fixtures/canonical-cases.json', import.meta.url)),
    'utf8',
  ),
);

describe('canonicalName (shared backend fixture)', () => {
  it.each(ROWS)('%j -> %j', (input, expected) => {
    expect(canonicalName(input)).toBe(expected);
  });

  it('is idempotent for every fixture row', () => {
    for (const [input] of ROWS) {
      const once = canonicalName(input);
      expect(canonicalName(once)).toBe(once);
    }
  });
});
