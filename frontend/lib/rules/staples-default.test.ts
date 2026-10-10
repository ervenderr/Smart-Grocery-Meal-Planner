import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { canonicalName } from '@/lib/preferences/canonical';
import { DEFAULT_STAPLE_NAMES, resolveStapleSet } from './staples-default';

const FIXTURE: string[] = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../../../backend/tests/fixtures/default-staples.json', import.meta.url)),
    'utf8',
  ),
);

describe('DEFAULT_STAPLE_NAMES', () => {
  it('equals the shared backend fixture', () => {
    expect([...DEFAULT_STAPLE_NAMES]).toEqual(FIXTURE);
  });
  it('is frozen', () => {
    expect(Object.isFrozen(DEFAULT_STAPLE_NAMES)).toBe(true);
  });
});

describe('resolveStapleSet', () => {
  it('falls back to the bundled defaults', () => {
    const set = resolveStapleSet(undefined, undefined);
    expect(set).toEqual(new Set(DEFAULT_STAPLE_NAMES.map(canonicalName)));
  });
  it('canonicalizes and drops empties', () => {
    expect(resolveStapleSet(['Salt', '  '], ['x'])).toEqual(new Set(['salt']));
  });
  it('empty list means user cleared staples', () => {
    expect(resolveStapleSet([], ['salt']).size).toBe(0);
  });
  it('uses defaultStapleNames when stapleNames is undefined', () => {
    expect(resolveStapleSet(undefined, ['Sugar'])).toEqual(new Set(['sugar']));
  });
});
