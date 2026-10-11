import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
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

/** A Transaction.updates delivery (Ask-to-Buy approval, other device, refund...). */
export interface StoreTransactionUpdate extends StoreTransaction {
  productId: string;
  revoked: boolean;
}

export const TRANSACTION_UPDATED_EVENT = 'transactionUpdated';

export interface KumaunStorePlugin {
  getProduct(options: { productId: string }): Promise<StoreProduct>;
  purchase(options: { productId: string }): Promise<PurchaseResult>;
  currentEntitlements(options: { productId: string }): Promise<{ transactions: StoreTransaction[] }>;
  sync(): Promise<void>;
  finish(options: { transactionId: string }): Promise<void>;
  /** Finishes unfinished transactions for the product without verifying (server already active). */
  finishUnfinished(options: { productId: string }): Promise<{ finished: number }>;
  addListener(
    event: typeof TRANSACTION_UPDATED_EVENT,
    listener: (update: StoreTransactionUpdate) => void
  ): Promise<PluginListenerHandle>;
}

let cached: KumaunStorePlugin | null = null;

/** Resolves null on web; on native returns the memoized registered plugin proxy. */
export async function getStorePlugin(cap?: CapacitorLike): Promise<KumaunStorePlugin | null> {
  if (!(cap ? isNative(cap) : isNative())) return null;
  if (!cached) cached = registerPlugin<KumaunStorePlugin>('KumaunStore');
  return cached;
}
