import { readFileSync } from 'fs';
import path from 'path';
import { buildForbiddenTerms, violates } from '../src/modules/ai/dietary-filter';

interface Row {
  readonly restrictions: readonly string[];
  readonly texts: readonly string[];
  readonly expected: boolean;
}

const ROWS: readonly Row[] = JSON.parse(
  readFileSync(path.join(__dirname, 'fixtures', 'diet-cases.json'), 'utf8'),
);

describe('rules parity: diet filter (shared fixture with the client engine)', () => {
  it('has enough rows', () => {
    expect(ROWS.length).toBeGreaterThanOrEqual(30);
  });

  it.each(ROWS)('%j', (row) => {
    expect(violates(row.texts, buildForbiddenTerms(row.restrictions))).toBe(row.expected);
  });
});
