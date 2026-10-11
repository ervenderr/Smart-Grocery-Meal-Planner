'use client';

import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  entitlementsApi,
  ENTITLEMENT_QUERY_KEY,
  type EntitlementMe,
} from '@/lib/api/entitlements';
import { useAuthStore } from '@/lib/stores/auth-store';
import { haptic } from '@/lib/native/native-haptics';
import {
  purchaseFull,
  restorePurchases,
  type PurchaseOutcome,
  type RestoreOutcome,
} from '@/lib/native/store/store-service';
import type { StoreProduct } from '@/lib/native/store/store-plugin';
import {
  browserStorage,
  readCachedEntitlement,
  writeCachedEntitlement,
} from '@/lib/entitlements/entitlement-cache';
import { refreshEntitlementQueries } from '@/lib/entitlements/refresh';
import { outcomeMessage, type FlowState, type Message } from '@/lib/entitlements/view-model';
import { useStoreProduct } from './use-store-product';

export interface UseEntitlement {
  me: EntitlementMe | undefined;
  meLoading: boolean;
  product: StoreProduct | null | undefined;
  productError: boolean;
  flow: FlowState;
  message: Message;
  isUnlocked: boolean;
  retryProduct(): void;
  purchase(): Promise<PurchaseOutcome | null>;
  restore(): Promise<RestoreOutcome | null>;
}

const UNLOCKED_KINDS = ['unlocked', 'restored'];

function flowAfter(kind: string): FlowState {
  if (kind === 'unlocked') return 'success';
  if (kind === 'verify-pending') return 'verify-pending';
  return 'idle';
}

function notifyUnlocked(): void {
  haptic('success');
}

/** The /entitlements/me query with the localStorage placeholder. Shared by every observer. */
export function useEntitlementMeQuery() {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const signedIn = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: ENTITLEMENT_QUERY_KEY,
    queryFn: async () => {
      const result = await entitlementsApi.me();
      writeCachedEntitlement(userId, result, browserStorage());
      return result;
    },
    staleTime: 5 * 60_000,
    enabled: signedIn,
    placeholderData: () => readCachedEntitlement(userId, browserStorage()),
  });
}

/**
 * Purchase/restore state for one screen. The launch/resume recheck is NOT here:
 * it runs once, app-wide, in EntitlementRuntime (WR-07).
 */
export function useEntitlement(): UseEntitlement {
  const { product, productError, retryProduct, getDeps } = useStoreProduct();
  const [flow, setFlow] = useState<FlowState>('idle');
  const [message, setMessage] = useState<Message>(null);

  const query = useEntitlementMeQuery();
  const me = query.data;

  const run = useCallback(
    async <T extends PurchaseOutcome | RestoreOutcome>(
      busy: FlowState,
      source: 'purchase' | 'restore',
      action: (deps: NonNullable<Awaited<ReturnType<typeof getDeps>>>) => Promise<T>
    ): Promise<T | null> => {
      const deps = await getDeps();
      if (!deps) return null;
      setFlow(busy);
      setMessage(null);
      const outcome = await action(deps);
      setMessage(outcomeMessage(outcome, source));
      setFlow(flowAfter(outcome.kind));
      if (UNLOCKED_KINDS.includes(outcome.kind)) {
        refreshEntitlementQueries();
        notifyUnlocked();
      } else if (outcome.kind === 'revoked') {
        refreshEntitlementQueries();
      }
      return outcome;
    },
    [getDeps]
  );

  const purchase = useCallback(() => run('purchasing', 'purchase', purchaseFull), [run]);
  const restore = useCallback(() => run('restoring', 'restore', restorePurchases), [run]);

  return {
    me,
    meLoading: query.isLoading,
    product,
    productError,
    flow,
    message,
    isUnlocked: me?.status === 'active',
    retryProduct,
    purchase,
    restore,
  };
}
