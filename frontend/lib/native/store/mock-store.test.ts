import { describe, expect, it } from 'vitest';
import { createMockStore, MOCK_STORE_MARKER } from './mock-store';

describe('createMockStore', () => {
  it('returns the configured localized price', async () => {
    const store = createMockStore({ price: '$9.99' });
    expect((await store.getProduct({ productId: 'x' })).localizedPrice).toBe('$9.99');
  });

  it('purchase succeeds with a fake jws by default and records ownership', async () => {
    const store = createMockStore();
    const r = await store.purchase({ productId: 'x' });
    expect(r.status).toBe('success');
    if (r.status === 'success') expect(r.jws).toContain('mock.jws');
    expect((await store.currentEntitlements({ productId: 'x' })).transactions).toHaveLength(1);
  });

  it('plays scripted outcomes in order', async () => {
    const store = createMockStore({ purchaseOutcomes: ['cancelled', 'pending', 'reject'] });
    expect(await store.purchase({ productId: 'x' })).toEqual({ status: 'cancelled' });
    expect(await store.purchase({ productId: 'x' })).toEqual({ status: 'pending' });
    await expect(store.purchase({ productId: 'x' })).rejects.toThrow();
  });

  it('surfaces afterSync transactions only after sync()', async () => {
    const tx = { jws: 'j', originalTransactionId: 'o', transactionId: 't' };
    const store = createMockStore({ afterSync: [tx] });
    expect((await store.currentEntitlements({ productId: 'x' })).transactions).toEqual([]);
    await store.sync();
    expect((await store.currentEntitlements({ productId: 'x' })).transactions).toEqual([tx]);
  });

  it('carries the verify-bundle marker', () => {
    expect(MOCK_STORE_MARKER).toContain('KITCHA_E2E');
  });

  it('emits transaction updates to listeners until removed', async () => {
    const store = createMockStore();
    const seen: string[] = [];
    const handle = await store.addListener('transactionUpdated', (u) => seen.push(u.transactionId));
    const u = { jws: 'j', originalTransactionId: 'o', transactionId: 't1', productId: 'p', revoked: false };
    store.emitUpdate(u);
    await handle.remove();
    store.emitUpdate({ ...u, transactionId: 't2' });
    expect(seen).toEqual(['t1']);
    expect(await store.finishUnfinished({ productId: 'p' })).toEqual({ finished: 0 });
  });
});
