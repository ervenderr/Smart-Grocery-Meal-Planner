import { describe, expect, it } from 'vitest';
import {
  E2E_LINE_PREFIX,
  E2E_PHASE_KEY,
  findTokenLeaks,
  formatE2eLine,
  nextPhase,
} from './self-check';

describe('constants', () => {
  it('exposes the stable prefix and phase key', () => {
    expect(E2E_LINE_PREFIX).toBe('KITCHA_E2E');
    expect(E2E_PHASE_KEY).toBe('kitcha:e2e-phase');
  });
});

describe('formatE2eLine', () => {
  it('formats a step with data', () => {
    expect(formatE2eLine('login', { ok: true, leaks: 0 })).toBe(
      'KITCHA_E2E {"step":"login","ok":true,"leaks":0}'
    );
  });

  it('drops sensitive keys case-insensitively', () => {
    const line = formatE2eLine('login', {
      ok: true,
      token: 'T',
      Token: 'T',
      refreshToken: 'R',
      PASSWORD: 'P',
      Email: 'e@x.com',
    });
    expect(line).toBe('KITCHA_E2E {"step":"login","ok":true}');
    expect(line).not.toMatch(/T"|R"|P"|e@x/);
  });

  it('does not mutate the input', () => {
    const data = Object.freeze({ ok: true, token: 'T' });
    expect(() => formatE2eLine('x', data)).not.toThrow();
    expect(data.token).toBe('T');
  });

  it('is parseable after the prefix', () => {
    const line = formatE2eLine('scan', { ok: false, n: 2 });
    expect(JSON.parse(line.slice(E2E_LINE_PREFIX.length + 1))).toEqual({ step: 'scan', ok: false, n: 2 });
  });
});

describe('findTokenLeaks', () => {
  it('returns keys whose value contains the token', () => {
    expect(findTokenLeaks([['a', 'x'], ['auth-storage', '{"token":"T1"}']], 'T1')).toEqual(['auth-storage']);
  });

  it('returns [] for an empty token', () => {
    expect(findTokenLeaks([['a', 'anything']], '')).toEqual([]);
  });

  it('returns [] when nothing matches or entries are empty', () => {
    expect(findTokenLeaks([['a', 'x']], 'T1')).toEqual([]);
    expect(findTokenLeaks([], 'T1')).toEqual([]);
  });
});

describe('nextPhase', () => {
  it.each([
    [null, 'login'],
    ['login', 'relaunch'],
    ['relaunch', 'done'],
    ['done', 'done'],
    ['garbage', 'login'],
  ] as const)('%s -> %s', (current, expected) => {
    expect(nextPhase(current)).toBe(expected);
  });
});
