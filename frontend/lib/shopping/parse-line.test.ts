import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseIngredientLine, quickAddFromLine } from './parse-line';

interface Row {
  input: string;
  expected: { quantity: string | null; unit: string | null; name: string; note: string | null };
}

const rows: Row[] = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../../../backend/tests/fixtures/parse-line-cases.json', import.meta.url)),
    'utf8'
  )
);

describe('parseIngredientLine (shared backend fixture)', () => {
  it('has at least 30 rows', () => {
    expect(rows.length).toBeGreaterThanOrEqual(30);
  });

  it.each(rows.map((r) => [r.input, r] as const))('matches backend for %j', (_input, row) => {
    expect(parseIngredientLine(row.input)).toEqual(row.expected);
  });

  it('returns quickly for a 5000 char input', () => {
    const start = Date.now();
    parseIngredientLine('1'.repeat(5000));
    parseIngredientLine('1 ' + 'a'.repeat(4998));
    expect(Date.now() - start).toBeLessThan(50);
  });
});

describe('quickAddFromLine', () => {
  it.each([
    ['2 kg rice', { itemName: 'rice', quantity: 2, unit: 'kg' }],
    ['2 cloves garlic', { itemName: 'garlic', quantity: 2, unit: 'clove' }],
    ['3 eggs', { itemName: 'eggs', quantity: 3, unit: 'pieces' }],
    ['1 pizza', { itemName: 'pizza', quantity: 1, unit: 'pieces' }],
  ])('parses %j', (line, expected) => {
    expect(quickAddFromLine(line)).toEqual(expected);
  });

  it.each(['Milk', 'salt to taste', '2', '7up', '2% milk', '2 percent milk', '100% juice', ''])(
    'returns null for %j',
    (line) => {
      expect(quickAddFromLine(line)).toBeNull();
    }
  );

  it('caps the item name length', () => {
    const result = quickAddFromLine(`2 kg ${'x'.repeat(300)}`);
    expect(result?.itemName.length).toBeLessThanOrEqual(100);
  });
});
