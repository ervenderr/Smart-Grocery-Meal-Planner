import { readFileSync } from 'fs';
import { join } from 'path';
import { canonicalName } from '../src/modules/intelligence/canonical';
import {
  DEFAULT_STAPLE_NAMES,
  MAX_STAPLES,
  MAX_STAPLE_LENGTH,
  everyStapleIsValid,
  filterStaples,
  resolveStaples,
  sanitizeStapleNames,
} from '../src/modules/intelligence/staples';

describe('sanitizeStapleNames', () => {
  it.each([
    [[' Salt ', 'SALT', 'olive oil'], ['salt', 'olive oil']],
    [['Scallions'], ['green onion']],
    [['!!!'], []],
    ['salt', []],
    [{}, []],
    [null, []],
    [undefined, []],
    [[123, null, 'Salt'], ['salt']],
  ])('sanitize %j -> %j', (input, expected) => {
    expect(sanitizeStapleNames(input)).toEqual(expected);
  });
});

describe('everyStapleIsValid', () => {
  it('accepts well-formed lists', () => {
    expect(everyStapleIsValid(['salt', 'Olive Oil'])).toBe(true);
    expect(everyStapleIsValid([])).toBe(true);
  });
  it.each([
    [[123], 'Each staple must be text'],
    [[null], 'Each staple must be text'],
    [[''], 'Each staple must be 1-60 characters'],
    [['a'.repeat(MAX_STAPLE_LENGTH + 1)], 'Each staple must be 1-60 characters'],
    [['!!!'], 'Each staple must contain letters or numbers'],
  ])('rejects %j', (input, message) => {
    expect(() => everyStapleIsValid(input)).toThrow(message);
  });
});

describe('DEFAULT_STAPLE_NAMES fixed point', () => {
  it('has 15 unique entries', () => {
    expect(DEFAULT_STAPLE_NAMES).toHaveLength(15);
    expect(new Set(DEFAULT_STAPLE_NAMES).size).toBe(15);
    expect(MAX_STAPLES).toBe(100);
  });
  it.each([...DEFAULT_STAPLE_NAMES])('%s is canonical', (entry) => {
    expect(canonicalName(entry)).toBe(entry);
  });
});

describe('default parity', () => {
  const root = join(__dirname, '..', 'prisma');
  const quoted = (body: string): string[] =>
    [...body.matchAll(/'([^']*)'|"([^"]*)"/g)].map((m) => m[1] ?? m[2]);

  it('schema.prisma default equals the constant', () => {
    const schema = readFileSync(join(root, 'schema.prisma'), 'utf8');
    const m = schema.match(/stapleNames\s+String\[\]\s+@default\(\[([^\]]*)\]\)/);
    expect(m).not.toBeNull();
    expect(quoted(m![1])).toEqual([...DEFAULT_STAPLE_NAMES]);
  });

  it('migration SQL default equals the constant (20261012000000_user_staple_names)', () => {
    const sql = readFileSync(
      join(root, 'migrations', '20261012000000_user_staple_names', 'migration.sql'),
      'utf8'
    );
    const m = sql.match(/ARRAY\[([^\]]*)\]::TEXT\[\]/);
    expect(m).not.toBeNull();
    expect(quoted(m![1])).toEqual([...DEFAULT_STAPLE_NAMES]);
  });
});

describe('resolveStaples', () => {
  it('falls back to defaults for null/undefined', () => {
    expect(resolveStaples(null)).toEqual(new Set(DEFAULT_STAPLE_NAMES));
    expect(resolveStaples(undefined)).toEqual(new Set(DEFAULT_STAPLE_NAMES));
  });
  it('keeps an explicit empty list empty', () => {
    expect(resolveStaples([]).size).toBe(0);
  });
  it('re-canonicalizes stored values', () => {
    expect(resolveStaples(['Salt'])).toEqual(new Set(['salt']));
  });
});

describe('filterStaples', () => {
  const g = (canonical: string, displayName: string) => Object.freeze({ canonical, displayName });
  it('removes exact canonical matches only and reports display names', () => {
    const groups = Object.freeze([
      g('pepper', 'Pepper'),
      g('bell pepper', 'Bell Pepper'),
      g('flour', 'Flour'),
      g('almond flour', 'Almond Flour'),
    ]);
    const staples: ReadonlySet<string> = new Set(['pepper', 'flour']);
    const { kept, skipped } = filterStaples(groups, staples);
    expect(kept.map((x) => x.displayName)).toEqual(['Bell Pepper', 'Almond Flour']);
    expect(skipped).toEqual(['Pepper', 'Flour']);
    expect(groups).toHaveLength(4);
  });
  it('dedupes skipped display names in first-seen order', () => {
    const { skipped } = filterStaples(
      [g('salt', 'Salt'), g('salt', 'Salt'), g('salt', 'Sea Salt')],
      new Set(['salt'])
    );
    expect(skipped).toEqual(['Salt', 'Sea Salt']);
  });
});
