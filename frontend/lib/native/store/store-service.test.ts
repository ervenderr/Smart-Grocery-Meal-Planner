import { describe, expect, it } from 'vitest';
import type { VerifyResult } from '../../api/entitlements';
import { OfflineError } from '../../api/offline-error';
import type {
  KumaunStorePlugin,
  PurchaseResult,
  StoreTransaction,
  StoreTransactionUpdate,
} from './store-plugin';
import {
  handleTransactionUpdate,
  loadProduct,
  purchaseFull,
  recheckEntitlements,
  restorePurchases,
  subscribeTransactionUpdates,
  type StoreDeps,
  type UpdateResult,
} from './store-service';

const tx = (n: number): StoreTransaction => ({
  jws: `jws-${n}`,
  originalTransactionId: `o${n}`,
  transactionId: `${n}`,
});
const active: VerifyResult = { status: 'active', productId: 'p', environment: 'Sandbox', purchasedAt: 'x' };
const httpError = (status: number, code?: string) =>
  Object.assign(new Error('http'), { response: { status, data: code ? { code } : {} } });

interface Setup {
  deps: StoreDeps;
  calls: string[];
  verifyCalls: Array<{ jws: string; key: string }>;
  emit(update: StoreTransactionUpdate): void;
  listenerCount(): number;
}

function setup(opts: {
  purchase?: PurchaseResult | Error;
  owned?: StoreTransaction[][];
  syncError?: Error;
  verify?: (jws: string) => Promise<VerifyResult>;
  online?: boolean;
  product?: Error;
} = {}): Setup {
  const calls: string[] = [];
  const verifyCalls: Array<{ jws: string; key: string }> = [];
  let ownedIdx = 0;
  let listeners: Array<(u: StoreTransactionUpdate) => void> = [];
  const owned = opts.owned ?? [[]];
  const plugin: KumaunStorePlugin = {
    async getProduct(o) {
      calls.push('getProduct');
      if (opts.product) throw opts.product;
      return { productId: o.productId, displayName: 'Kumaun Full', localizedPrice: '$9.99', price: '9.99', currencyCode: 'USD' };
    },
    async purchase() {
      calls.push('purchase');
      if (opts.purchase instanceof Error) throw opts.purchase;
      return opts.purchase ?? { status: 'success', ...tx(1) };
    },
    async currentEntitlements() {
      calls.push('currentEntitlements');
      const t = owned[Math.min(ownedIdx, owned.length - 1)];
      ownedIdx += 1;
      return { transactions: t };
    },
    async sync() {
      calls.push('sync');
      if (opts.syncError) throw opts.syncError;
    },
    async finish(o) {
      calls.push(`finish:${o.transactionId}`);
    },
    async finishUnfinished() {
      calls.push('finishUnfinished');
      return { finished: 1 };
    },
    async addListener(_event, listener) {
      listeners = [...listeners, listener];
      return {
        remove: async () => {
          listeners = listeners.filter((l) => l !== listener);
        },
      };
    },
  };
  let keys = 0;
  const deps: StoreDeps = {
    plugin,
    verify: async (jws, key) => {
      verifyCalls.push({ jws, key });
      return (opts.verify ?? (async () => active))(jws);
    },
    newKey: () => `key-${++keys}`,
    isOnline: () => opts.online ?? true,
  };
  return {
    deps,
    calls,
    verifyCalls,
    emit: (u) => listeners.forEach((l) => l(u)),
    listenerCount: () => listeners.length,
  };
}

describe('loadProduct', () => {
  it('returns the product', async () => {
    expect((await loadProduct(setup().deps))?.localizedPrice).toBe('$9.99');
  });
  it('returns null when the plugin rejects', async () => {
    expect(await loadProduct(setup({ product: new Error('x') }).deps)).toBeNull();
  });
});

describe('purchaseFull', () => {
  it('unlocks and finishes once after verify 2xx', async () => {
    const s = setup();
    expect(await purchaseFull(s.deps)).toEqual({ kind: 'unlocked' });
    expect(s.calls.filter((c) => c.startsWith('finish'))).toEqual(['finish:1']);
    expect(s.verifyCalls).toEqual([{ jws: 'jws-1', key: 'key-1' }]);
  });
  it('finishes and reports revoked', async () => {
    const s = setup({ verify: async () => ({ ...active, status: 'revoked' }) });
    expect(await purchaseFull(s.deps)).toEqual({ kind: 'revoked' });
    expect(s.calls).toContain('finish:1');
  });
  it('cancelled never verifies', async () => {
    const s = setup({ purchase: { status: 'cancelled' } });
    expect(await purchaseFull(s.deps)).toEqual({ kind: 'cancelled' });
    expect(s.verifyCalls).toHaveLength(0);
  });
  it('pending maps to pending-approval', async () => {
    const s = setup({ purchase: { status: 'pending' } });
    expect(await purchaseFull(s.deps)).toEqual({ kind: 'pending-approval' });
    expect(s.verifyCalls).toHaveLength(0);
  });
  it('offline: no verify, no finish', async () => {
    const s = setup({ online: false });
    expect(await purchaseFull(s.deps)).toEqual({ kind: 'verify-pending' });
    expect(s.verifyCalls).toHaveLength(0);
    expect(s.calls.some((c) => c.startsWith('finish'))).toBe(false);
  });
  it.each([
    ['OfflineError', () => new OfflineError()],
    ['network error', () => new Error('Network Error')],
    ['503', () => httpError(503, 'VERIFICATION_UNAVAILABLE')],
    ['429 verify limiter', () => httpError(429, 'ENTITLEMENT_RATE_LIMITED')],
    ['429 api limiter', () => httpError(429)],
    ['409 idempotency in flight', () => httpError(409, 'IDEMPOTENCY_IN_FLIGHT')],
  ])('transient verify failure (%s) is verify-pending without finish', async (_n, make) => {
    const s = setup({ verify: async () => { throw make(); } });
    expect(await purchaseFull(s.deps)).toEqual({ kind: 'verify-pending' });
    expect(s.calls.some((c) => c.startsWith('finish'))).toBe(false);
  });
  it('409 claimed maps to claimed-elsewhere without finish', async () => {
    const s = setup({ verify: async () => { throw httpError(409, 'ENTITLEMENT_ALREADY_CLAIMED'); } });
    expect(await purchaseFull(s.deps)).toEqual({ kind: 'claimed-elsewhere' });
    expect(s.calls.some((c) => c.startsWith('finish'))).toBe(false);
  });
  it('409 with another code is still verify-failed', async () => {
    const s = setup({ verify: async () => { throw httpError(409, 'IDEMPOTENCY_KEY_REUSED'); } });
    expect(await purchaseFull(s.deps)).toEqual({ kind: 'verify-failed' });
  });
  it('400 maps to verify-failed', async () => {
    const s = setup({ verify: async () => { throw httpError(400, 'INVALID_TRANSACTION'); } });
    expect(await purchaseFull(s.deps)).toEqual({ kind: 'verify-failed' });
  });
  it('plugin rejection maps to failed', async () => {
    expect(await purchaseFull(setup({ purchase: new Error('boom') }).deps)).toEqual({ kind: 'failed' });
  });
  it('uses exactly one idempotency key per action', async () => {
    const s = setup();
    await purchaseFull(s.deps);
    expect(s.verifyCalls.map((c) => c.key)).toEqual(['key-1']);
  });
});

describe('restorePurchases', () => {
  it('verifies existing entitlements without calling sync', async () => {
    const s = setup({ owned: [[tx(1)]] });
    expect(await restorePurchases(s.deps)).toEqual({ kind: 'restored' });
    expect(s.calls).not.toContain('sync');
    expect(s.calls).toContain('finish:1');
  });
  it('verifies newest first with one action key', async () => {
    const s = setup({ owned: [[tx(2), tx(10)]] });
    await restorePurchases(s.deps);
    expect(s.verifyCalls.map((c) => c.jws)).toEqual(['jws-10', 'jws-2']);
    expect(s.verifyCalls[0].key).toBe('key-1');
    expect(s.verifyCalls[1].key).toBe('key-1:1');
  });
  it('syncs when empty, then none if still empty', async () => {
    const s = setup({ owned: [[], []] });
    expect(await restorePurchases(s.deps)).toEqual({ kind: 'none' });
    expect(s.calls.filter((c) => c === 'sync')).toHaveLength(1);
    expect(s.verifyCalls).toHaveLength(0);
  });
  it('syncs when empty, then restores if found', async () => {
    const s = setup({ owned: [[], [tx(3)]] });
    expect(await restorePurchases(s.deps)).toEqual({ kind: 'restored' });
    expect(s.calls.indexOf('sync')).toBeLessThan(s.calls.lastIndexOf('currentEntitlements'));
  });
  it('sync rejection is failed', async () => {
    const s = setup({ owned: [[]], syncError: new Error('x') });
    expect(await restorePurchases(s.deps)).toEqual({ kind: 'failed' });
  });
  it('transient verify is verify-pending', async () => {
    const s = setup({ owned: [[tx(1)]], verify: async () => { throw httpError(503); } });
    expect(await restorePurchases(s.deps)).toEqual({ kind: 'verify-pending' });
  });
  it('rate-limited restore is verify-pending, not failed', async () => {
    const s = setup({ owned: [[tx(1)]], verify: async () => { throw httpError(429, 'ENTITLEMENT_RATE_LIMITED'); } });
    expect(await restorePurchases(s.deps)).toEqual({ kind: 'verify-pending' });
    expect(s.calls.some((c) => c.startsWith('finish'))).toBe(false);
  });
  it('claimed elsewhere and revoked are reported', async () => {
    const c = setup({ owned: [[tx(1)]], verify: async () => { throw httpError(409, 'ENTITLEMENT_ALREADY_CLAIMED'); } });
    expect(await restorePurchases(c.deps)).toEqual({ kind: 'claimed-elsewhere' });
    const r = setup({ owned: [[tx(1)]], verify: async () => ({ ...active, status: 'revoked' }) });
    expect(await restorePurchases(r.deps)).toEqual({ kind: 'revoked' });
  });
  it('currentEntitlements rejection is failed', async () => {
    const s = setup();
    s.deps.plugin.currentEntitlements = async () => { throw new Error('x'); };
    expect(await restorePurchases(s.deps)).toEqual({ kind: 'failed' });
  });
});

describe('recheckEntitlements', () => {
  it('when server says active: no verify, only finishes unfinished device transactions', async () => {
    const s = setup({ owned: [[tx(1)]] });
    expect(await recheckEntitlements(s.deps, 'active')).toBe('skipped');
    expect(s.calls).toEqual(['finishUnfinished']);
    expect(s.verifyCalls).toHaveLength(0);
  });
  it('a finishUnfinished rejection is swallowed', async () => {
    const s = setup();
    s.deps.plugin.finishUnfinished = async () => { throw new Error('x'); };
    expect(await recheckEntitlements(s.deps, 'active')).toBe('skipped');
  });
  it.each(['none', 'revoked'] as const)('verifies device transactions when server says %s', async (status) => {
    const s = setup({ owned: [[tx(1)]] });
    expect(await recheckEntitlements(s.deps, status)).toBe('verified');
    expect(s.calls).not.toContain('sync');
  });
  it('skips when the device has none, never syncing', async () => {
    const s = setup({ owned: [[]] });
    expect(await recheckEntitlements(s.deps, 'none')).toBe('skipped');
    expect(s.calls).not.toContain('sync');
  });
  it('pending when offline, failed on hard rejection', async () => {
    expect(await recheckEntitlements(setup({ owned: [[tx(1)]], online: false }).deps, 'none')).toBe('pending');
    const f = setup({ owned: [[tx(1)]], verify: async () => { throw httpError(400); } });
    expect(await recheckEntitlements(f.deps, 'none')).toBe('failed');
  });
});

const update = (n: number, productId = 'app.kitcha.mobile.full'): StoreTransactionUpdate => ({
  ...tx(n),
  productId,
  revoked: false,
});

describe('handleTransactionUpdate (WR-04)', () => {
  it('verifies then finishes an update for the product', async () => {
    const s = setup();
    expect(await handleTransactionUpdate(s.deps, update(7))).toBe('verified');
    expect(s.verifyCalls.map((c) => c.jws)).toEqual(['jws-7']);
    expect(s.calls).toContain('finish:7');
  });
  it('ignores other products', async () => {
    const s = setup();
    expect(await handleTransactionUpdate(s.deps, update(7, 'other.product'))).toBe('ignored');
    expect(s.verifyCalls).toHaveLength(0);
  });
  it('transient verify leaves it unfinished (pending)', async () => {
    const s = setup({ verify: async () => { throw httpError(429); } });
    expect(await handleTransactionUpdate(s.deps, update(7))).toBe('pending');
    expect(s.calls.some((c) => c.startsWith('finish'))).toBe(false);
  });
  it('maps claimed and hard failures', async () => {
    const c = setup({ verify: async () => { throw httpError(409, 'ENTITLEMENT_ALREADY_CLAIMED'); } });
    expect(await handleTransactionUpdate(c.deps, update(1))).toBe('claimed-elsewhere');
    const f = setup({ verify: async () => { throw httpError(400); } });
    expect(await handleTransactionUpdate(f.deps, update(1))).toBe('failed');
  });
  it('a revoked delivery is still verified so the server learns the refund', async () => {
    const s = setup({ verify: async () => ({ ...active, status: 'revoked' }) });
    expect(await handleTransactionUpdate(s.deps, { ...update(3), revoked: true })).toBe('verified');
  });
});

describe('subscribeTransactionUpdates (WR-04)', () => {
  const flush = () => new Promise((r) => setTimeout(r, 0));

  it('handles deliveries one at a time and reports results', async () => {
    const order: string[] = [];
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const s = setup({
      verify: async (jws) => {
        order.push(`start:${jws}`);
        if (jws === 'jws-1') await gate;
        order.push(`end:${jws}`);
        return active;
      },
    });
    const results: UpdateResult[] = [];
    const unsubscribe = await subscribeTransactionUpdates(s.deps, (r) => results.push(r));
    s.emit(update(1));
    s.emit(update(2));
    await flush();
    expect(order).toEqual(['start:jws-1']);
    release();
    await flush();
    await flush();
    expect(order).toEqual(['start:jws-1', 'end:jws-1', 'start:jws-2', 'end:jws-2']);
    expect(results).toEqual(['verified', 'verified']);
    unsubscribe();
    await flush();
    expect(s.listenerCount()).toBe(0);
  });
});
