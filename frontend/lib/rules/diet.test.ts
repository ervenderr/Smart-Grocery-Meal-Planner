import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  buildForbiddenTerms,
  compileRestrictions,
  MAX_RESTRICTION_LENGTH,
  MAX_RESTRICTIONS,
  violates,
  violatesCompiled,
} from './diet';

interface Row {
  readonly restrictions: string[];
  readonly texts: string[];
  readonly expected: boolean;
}

const ROWS: Row[] = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../../../backend/tests/fixtures/diet-cases.json', import.meta.url)),
    'utf8',
  ),
);

describe('diet filter (shared backend fixture)', () => {
  it('has enough fixture rows', () => {
    expect(ROWS.length).toBeGreaterThanOrEqual(30);
  });

  it.each(ROWS)('%j', (row) => {
    expect(violates(row.texts, buildForbiddenTerms(row.restrictions))).toBe(row.expected);
  });

  it('compiled path equals plain path for every row', () => {
    for (const row of ROWS) {
      expect(violatesCompiled(row.texts, compileRestrictions(row.restrictions))).toBe(
        violates(row.texts, buildForbiddenTerms(row.restrictions)),
      );
    }
  });
});

describe('diet behavior', () => {
  it('expands tags and free text', () => {
    const vegan = buildForbiddenTerms(['vegan']);
    for (const t of ['milk', 'honey', 'chicken']) expect(vegan).toContain(t);
    const gf = buildForbiddenTerms(['gluten_free']);
    expect(gf).toContain('flour');
    expect(gf).toContain('soy sauce');
    const peanuts = buildForbiddenTerms(['no peanuts']);
    expect(peanuts).toContain('no peanuts');
    expect(peanuts).toContain('peanut');
  });

  it('matches whole words and documents over-filtering', () => {
    expect(violates(['Peanut butter cookies'], buildForbiddenTerms(['dairy-free']))).toBe(true);
    expect(violates(['buttermilk'], ['milk'])).toBe(false);
    expect(violates(['eggs'], ['egg'])).toBe(true);
  });

  it('handles empty inputs', () => {
    expect(violates([], ['milk'])).toBe(false);
    expect(violates(['milk'], [])).toBe(false);
  });

  it('caps restriction count and length', () => {
    const many = Array.from({ length: 50 }, (_, i) => `zzitem${i}`);
    const patterns = compileRestrictions(many);
    expect(MAX_RESTRICTIONS).toBe(20);
    expect(MAX_RESTRICTION_LENGTH).toBe(60);
    expect(Object.isFrozen(patterns)).toBe(true);
    expect(violatesCompiled(['zzitem19'], patterns)).toBe(true);
    expect(violatesCompiled(['zzitem25'], patterns)).toBe(false);
    const long = compileRestrictions(['a'.repeat(200)]);
    expect(long.every((p) => p.source.length < 200)).toBe(true);
  });
});
