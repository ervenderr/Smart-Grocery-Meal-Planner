'use client';

import { useEntitlementRecheck } from '@/lib/hooks/use-entitlement-recheck';
import { useStoreTransactionUpdates } from '@/lib/hooks/use-store-transaction-updates';

/**
 * Single app-level owner of background StoreKit work (WR-04, WR-07): the
 * Transaction.updates listener and the launch/resume recheck. Screens that show
 * purchase UI (Settings card, upgrade sheet) never recheck on their own.
 * Renders nothing; mounted on native only.
 */
export function EntitlementRuntime() {
  useStoreTransactionUpdates(true);
  useEntitlementRecheck(true);
  return null;
}
