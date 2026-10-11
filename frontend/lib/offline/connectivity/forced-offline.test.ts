import { describe, it, expect } from 'vitest';
import { isForcedOffline, setForcedOffline } from './forced-offline';

function fakeStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
    removeItem: (k: string) => {
      delete data[k];
    },
    data,
  };
}
const KEY = 'kitcha:e2e-force-offline';

describe('forced-offline', () => {
  it('ignores storage when e2e flag undefined', () => {
    expect(isForcedOffline(fakeStorage({ [KEY]: '1' }), undefined)).toBe(false);
  });
  it('ignores storage when e2e flag is 0', () => {
    expect(isForcedOffline(fakeStorage({ [KEY]: '1' }), '0')).toBe(false);
  });
  it('honored when e2e flag 1 and stored 1', () => {
    expect(isForcedOffline(fakeStorage({ [KEY]: '1' }), '1')).toBe(true);
  });
  it('false when e2e on but nothing stored', () => {
    expect(isForcedOffline(fakeStorage(), '1')).toBe(false);
  });
  it('false when storage missing', () => {
    expect(isForcedOffline(undefined, '1')).toBe(false);
  });
  it('false when storage throws', () => {
    const s = {
      getItem: () => {
        throw new Error('x');
      },
    };
    expect(isForcedOffline(s, '1')).toBe(false);
  });
  it('setForcedOffline writes only when e2e', () => {
    const s = fakeStorage();
    setForcedOffline(true, s, undefined);
    expect(s.data[KEY]).toBeUndefined();
    setForcedOffline(true, s, '1');
    expect(s.data[KEY]).toBe('1');
    setForcedOffline(false, s, '1');
    expect(s.data[KEY]).toBeUndefined();
  });
});
