import { readFileSync } from 'fs';
import path from 'path';
import { round2 } from '../src/modules/intelligence/quantity';
import { MAX_LINE_LENGTH, parseIngredientLine } from '../src/modules/intelligence/parse-line';

interface Row {
  input: string;
  expected: { quantity: string | null; unit: string | null; name: string; note: string | null };
}

const rows: Row[] = JSON.parse(
  readFileSync(path.join(__dirname, 'fixtures/parse-line-cases.json'), 'utf8')
);

describe('parseIngredientLine (shared fixture)', () => {
  it('has at least 30 fixture rows', () => {
    expect(rows.length).toBeGreaterThanOrEqual(30);
  });

  it.each(rows.map((r) => [r.input, r] as const))('parses %j', (_input, row) => {
    const result = parseIngredientLine(row.input);
    expect({
      quantity: result.quantity === null ? null : round2(result.quantity).toFixed(2),
      unit: result.unit,
      name: result.name,
      note: result.note,
    }).toEqual(row.expected);
  });
});

describe('parseIngredientLine DoS guard', () => {
  it('exports the length cap', () => {
    expect(MAX_LINE_LENGTH).toBe(200);
  });

  it.each([['1'.repeat(5000)], ['1 ' + 'a'.repeat(4998)], ['1/'.repeat(2500)]])(
    'returns quickly for a 5000 char input',
    (input) => {
      const start = Date.now();
      parseIngredientLine(input);
      expect(Date.now() - start).toBeLessThan(50);
    }
  );
});
