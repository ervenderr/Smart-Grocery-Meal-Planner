import { readFileSync } from 'fs';
import path from 'path';
import { DEFAULT_STAPLE_NAMES } from '../src/modules/intelligence/staples';

const FIXTURE: readonly string[] = JSON.parse(
  readFileSync(path.join(__dirname, 'fixtures', 'default-staples.json'), 'utf8'),
);

describe('rules parity: default staples (shared fixture with the client engine)', () => {
  it('server DEFAULT_STAPLE_NAMES equals the shared fixture', () => {
    expect([...DEFAULT_STAPLE_NAMES]).toEqual([...FIXTURE]);
  });
});
