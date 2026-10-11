import { registerPlugin } from '@capacitor/core';
import { isNative, type CapacitorLike } from '../../platform/native';

export const IAP_PRODUCT_ID = 'app.kitcha.mobile.full';

export interface StoreProduct {
  productId: string;
  displayName: string;
  localizedPrice: string;
  price: string;
  currencyCode: string;
}

export interface StoreTransaction {
  jws: string;
  originalTransactionId: string;
  transactionId: string;
}

export type PurchaseResult =
  | ({ status: 'success' } & StoreTransaction)
  | { status: 'cancelled' }
  | { status: 'pending' };

export interface KumaunStorePlugin {
  getProduct(options: { productId: string }): Promise<StoreProduct>;
  purchase(options: { productId: string }): Promise<PurchaseResult>;
  currentEntitlements(options: { productId: string }): Promise<{ transactions: StoreTransaction[] }>;
  sync(): Promise<void>;
  finish(options: { transactionId: string }): Promise<void>;
}

let cached: KumaunStorePlugin | null = null;

/** Resolves null on web; on native returns the memoized registered plugin proxy. */
export async function getStorePlugin(cap?: CapacitorLike): Promise<KumaunStorePlugin | null> {
  if (!(cap ? isNative(cap) : isNative())) return null;
  if (!cached) cached = registerPlugin<KumaunStorePlugin>('KumaunStore');
  return cached;
}
