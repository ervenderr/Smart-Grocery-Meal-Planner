import type {
  KumaunStorePlugin,
  PurchaseResult,
  StoreProduct,
  StoreTransaction,
  StoreTransactionUpdate,
} from './store-plugin';

/** Contains the KITCHA_E2E marker so mobile/scripts/verify-bundle.sh fails a release export on leak. */
export const MOCK_STORE_MARKER = 'KITCHA_E2E_STORE_MOCK';

export interface MockStoreOptions {
  price?: string;
  productId?: string;
  /** Scripted purchase outcomes, consumed in order; the last one repeats. Default: success. */
  purchaseOutcomes?: ReadonlyArray<'success' | 'cancelled' | 'pending' | 'reject'>;
  /** Transactions already owned (for restore). */
  owned?: ReadonlyArray<StoreTransaction>;
  /** Transactions that appear only after sync() (AppStore.sync). */
  afterSync?: ReadonlyArray<StoreTransaction>;
  failProduct?: boolean;
  failSync?: boolean;
}

const PRODUCT_ID = 'app.kitcha.mobile.full';

function fakeTx(n: number): StoreTransaction {
  return { jws: `mock.jws.${n}`, originalTransactionId: `orig-${n}`, transactionId: `tx-${n}` };
}

export interface MockStore extends KumaunStorePlugin {
  /** Simulates a Transaction.updates delivery to current listeners. */
  emitUpdate(update: StoreTransactionUpdate): void;
}

export function createMockStore(options: MockStoreOptions = {}): MockStore {
  const price = options.price ?? '$9.99';
  const outcomes = options.purchaseOutcomes ?? ['success'];
  let purchaseCount = 0;
  let owned: ReadonlyArray<StoreTransaction> = options.owned ?? [];
  let listeners: ReadonlyArray<(u: StoreTransactionUpdate) => void> = [];

  return {
    async getProduct({ productId }): Promise<StoreProduct> {
      if (options.failProduct) throw new Error('product unavailable');
      return {
        productId: productId || options.productId || PRODUCT_ID,
        displayName: 'Kumaun Full',
        localizedPrice: price,
        price: price.replace(/[^0-9.]/g, '') || '9.99',
        currencyCode: 'USD',
      };
    },
    async purchase(): Promise<PurchaseResult> {
      const outcome = outcomes[Math.min(purchaseCount, outcomes.length - 1)];
      purchaseCount += 1;
      if (outcome === 'reject') throw new Error('purchase failed');
      if (outcome === 'cancelled') return { status: 'cancelled' };
      if (outcome === 'pending') return { status: 'pending' };
      const tx = fakeTx(purchaseCount);
      owned = [...owned, tx];
      return { status: 'success', ...tx };
    },
    async currentEntitlements() {
      return { transactions: [...owned] };
    },
    async sync() {
      if (options.failSync) throw new Error('sync failed');
      owned = [...owned, ...(options.afterSync ?? [])];
    },
    async finish() {
      /* no-op */
    },
    async finishUnfinished() {
      return { finished: 0 };
    },
    async addListener(_event, listener) {
      listeners = [...listeners, listener];
      return {
        remove: async () => {
          listeners = listeners.filter((l) => l !== listener);
        },
      };
    },
    emitUpdate(update) {
      for (const l of listeners) l(update);
    },
  };
}
