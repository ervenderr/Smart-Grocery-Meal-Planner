'use client';

import { useStoreTransactionUpdates } from '@/lib/hooks/use-store-transaction-updates';

/** Single app-level owner of background StoreKit work. Renders nothing; native only. */
export function EntitlementRuntime() {
  useStoreTransactionUpdates(true);
  return null;
}
