import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { familyKey, fromBase, resolveUnit, toBase, UNIT_EPSILON } from './units';

interface Row {
  readonly qty: number;
  readonly unit: string;
  readonly family: string;
  readonly unitKey: string;
  readonly base: number;
}

const ROWS: Row[] = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../../../backend/tests/fixtures/unit-convert-cases.json', import.meta.url)),
    'utf8',
  ),
);

describe('units (shared backend fixture)', () => {
  it('has enough fixture rows', () => {
    expect(ROWS.length).toBeGreaterThanOrEqual(40);
  });

  it.each(ROWS)('$qty "$unit" -> $family/$unitKey', (row) => {
    const resolved = resolveUnit(row.unit);
    expect(resolved.family).toBe(row.family);
    expect(resolved.unitKey).toBe(row.unitKey);
    const base = toBase(row.qty, resolved);
    expect(Math.abs(base - row.base)).toBeLessThanOrEqual(1e-9 * Math.max(1, Math.abs(row.base)));
  });
});

describe('units behavior', () => {
  it('resolves aliases and piece words', () => {
    expect(resolveUnit('Tbsp')).toMatchObject({ family: 'volume', unitKey: 'tbsp' });
    expect(resolveUnit('lb')).toMatchObject({ family: 'mass', unitKey: 'lbs' });
    for (const raw of ['items', 'pieces', '', null, undefined]) {
      expect(resolveUnit(raw)).toMatchObject({ family: 'count', unitKey: 'pieces' });
    }
    expect(resolveUnit('cloves')).toMatchObject({ family: 'count', unitKey: 'clove' });
  });

  it('converts to base exactly', () => {
    expect(toBase(1, resolveUnit('cups'))).toBe(236.5882365);
    expect(Math.abs(toBase(16, resolveUnit('tbsp')) - toBase(1, resolveUnit('cups')))).toBeLessThan(1e-9);
  });

  it('builds family keys', () => {
    expect(familyKey(resolveUnit('cloves'))).toBe('count:clove');
    expect(familyKey(resolveUnit('grams'))).toBe('mass');
    expect(familyKey(resolveUnit('cups'))).toBe('volume');
  });

  it('converts from base and passes through unknown keys', () => {
    expect(fromBase(1000, 'kg')).toBe(1);
    expect(fromBase(7, 'clove')).toBe(7);
  });

  it('returns frozen units and exposes an epsilon', () => {
    expect(Object.isFrozen(resolveUnit('g'))).toBe(true);
    expect(UNIT_EPSILON).toBe(1e-6);
  });
});
