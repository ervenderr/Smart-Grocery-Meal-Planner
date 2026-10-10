import { readFileSync } from 'fs';
import path from 'path';
import { resolveUnit, toBase } from '../src/modules/intelligence/units';
import { toDec } from '../src/modules/intelligence/quantity';

interface Row {
  readonly qty: number;
  readonly unit: string;
  readonly family: string;
  readonly unitKey: string;
  readonly base: number;
}

const ROWS: readonly Row[] = JSON.parse(
  readFileSync(path.join(__dirname, 'fixtures', 'unit-convert-cases.json'), 'utf8'),
);

describe('rules parity: units (shared fixture with the client engine)', () => {
  it('has enough rows', () => {
    expect(ROWS.length).toBeGreaterThanOrEqual(40);
  });

  it.each(ROWS)('$qty "$unit" -> $family/$unitKey', (row) => {
    const resolved = resolveUnit(row.unit);
    expect(resolved.family).toBe(row.family);
    expect(resolved.unitKey).toBe(row.unitKey);
    expect(toBase(toDec(row.qty), resolved).toNumber()).toBeCloseTo(row.base, 9);
  });
});
