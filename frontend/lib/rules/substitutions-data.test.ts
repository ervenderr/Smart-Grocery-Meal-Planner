import { describe, expect, it } from 'vitest';
import { canonicalName } from '@/lib/preferences/canonical';
import table from './data/substitutions.json';
import {
  DIETARY_TAGS,
  MAX_NOTE_LENGTH,
  RATIO_UNITS,
  substitutionTableSchema,
} from './substitution-schema';

const MIN_ENTRIES = 150;

describe('substitutions table', () => {
  it('passes the schema', () => {
    expect(() => substitutionTableSchema.parse(table)).not.toThrow();
  });

  it('uses canonical keys', () => {
    const bad = table.entries.filter((e) => canonicalName(e.ingredient) !== e.ingredient);
    expect(bad.map((e) => e.ingredient)).toEqual([]);
  });

  it('has unique keys and aliases with no alias equal to a key', () => {
    const keys = table.entries.map((e) => e.ingredient);
    expect(new Set(keys).size).toBe(keys.length);
    const aliases = table.entries.flatMap((e) => e.aliases.map((a) => canonicalName(a)));
    expect(new Set(aliases).size).toBe(aliases.length);
    expect(aliases.filter((a) => keys.includes(a))).toEqual([]);
    expect(aliases.filter((a) => a === '')).toEqual([]);
  });

  it('has valid ratios and units', () => {
    for (const e of table.entries) {
      for (const s of e.swaps) {
        expect(s.ratio.amount).toBeGreaterThan(0);
        expect(s.ratio.per).toBeGreaterThan(0);
        expect(RATIO_UNITS).toContain(s.ratio.unit);
        expect(RATIO_UNITS).toContain(s.ratio.perUnit);
        expect(s.note.length).toBeLessThanOrEqual(MAX_NOTE_LENGTH);
      }
    }
  });

  it('uses only known tags', () => {
    for (const e of table.entries) {
      for (const s of e.swaps) {
        for (const t of s.tags) expect(DIETARY_TAGS).toContain(t);
      }
    }
  });

  it('has unique integer ranks per entry', () => {
    for (const e of table.entries) {
      const ranks = e.swaps.map((s) => s.rank);
      expect(new Set(ranks).size, e.ingredient).toBe(ranks.length);
      ranks.forEach((r) => expect(Number.isInteger(r) && r >= 1).toBe(true));
    }
  });

  it('has resolvable pantryNames', () => {
    for (const e of table.entries) {
      for (const s of e.swaps) {
        for (const p of s.pantryNames) expect(canonicalName(p), `${e.ingredient}: ${p}`).not.toBe('');
      }
    }
  });

  it(`has at least ${MIN_ENTRIES} entries`, () => {
    expect(table.entries.length).toBeGreaterThanOrEqual(MIN_ENTRIES);
  });
});
