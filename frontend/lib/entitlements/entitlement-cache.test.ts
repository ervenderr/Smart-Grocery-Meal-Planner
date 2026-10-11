import { describe, expect, it } from 'vitest';
import type { EntitlementMe } from '@/lib/api/entitlements';
import { readCachedEntitlement, writeCachedEntitlement } from './entitlement-cache';

const me: EntitlementMe = {
  status: 'active',
  productId: 'p',
  environment: 'Sandbox',
  purchasedAt: null,
  revokedAt: null,
  limits: { pantry: null, aiDaily: 5, aiMonthly: null },
};

function memory(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
  } as Storage;
}

describe('entitlement cache', () => {
  it('round-trips per user', () => {
    const s = memory();
    writeCachedEntitlement('u1', me, s);
    expect(readCachedEntitlement('u1', s)).toEqual(me);
    expect(readCachedEntitlement('u2', s)).toBeUndefined();
  });
  it('ignores invalid or corrupt payloads', () => {
    const s = memory();
    s.setItem('kitcha:entitlement:u1', '{"status":"hacked"}');
    expect(readCachedEntitlement('u1', s)).toBeUndefined();
    s.setItem('kitcha:entitlement:u1', 'not json');
    expect(readCachedEntitlement('u1', s)).toBeUndefined();
  });
  it('tolerates missing user or storage and throwing storage', () => {
    expect(readCachedEntitlement(null, memory())).toBeUndefined();
    expect(readCachedEntitlement('u1', undefined)).toBeUndefined();
    const bad = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); } };
    expect(readCachedEntitlement('u1', bad)).toBeUndefined();
    expect(() => writeCachedEntitlement('u1', me, bad)).not.toThrow();
  });
});
