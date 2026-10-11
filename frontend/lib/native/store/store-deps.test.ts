import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { getStorePlugin } from './store-plugin';
import { getStoreDeps, setStoreDepsOverride } from './store-deps';
import { createMockStore } from './mock-store';
import type { StoreDeps } from './store-service';
import { createVerifyGate } from './verify-gate';

const fake: StoreDeps = {
  plugin: createMockStore(),
  verify: async () => ({ status: 'active', productId: 'p', environment: 'Sandbox', purchasedAt: '' }),
  newKey: () => 'k',
  isOnline: () => true,
  gate: createVerifyGate(),
};

afterEach(() => setStoreDepsOverride(null, '1'));

describe('getStorePlugin', () => {
  it('resolves null on web', async () => {
    expect(await getStorePlugin({ isNativePlatform: () => false })).toBeNull();
    expect(await getStorePlugin()).toBeNull();
  });
});

describe('store deps override', () => {
  it('is ignored unless the e2e flag is 1', async () => {
    setStoreDepsOverride(fake, '0');
    expect(await getStoreDeps(() => true, null, '0')).toBeNull();
    setStoreDepsOverride(fake, undefined);
    expect(await getStoreDeps(() => true, null, undefined)).toBeNull();
  });

  it('is returned when the e2e flag is 1', async () => {
    setStoreDepsOverride(fake, '1');
    expect(await getStoreDeps(() => true, null, '1')).toBe(fake);
  });

  it('returns null on web without an override', async () => {
    expect(await getStoreDeps(() => true, null, '1')).toBeNull();
  });

  it('store-deps.ts never references the mock store', () => {
    const src = readFileSync(join(__dirname, 'store-deps.ts'), 'utf8');
    expect(src).not.toContain('mock-store');
  });
});
