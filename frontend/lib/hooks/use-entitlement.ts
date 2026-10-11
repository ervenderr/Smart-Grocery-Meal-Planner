'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryClient, queryKeys } from '@/lib/react-query';
import {
  entitlementsApi,
  ENTITLEMENT_QUERY_KEY,
  type EntitlementMe,
  type EntitlementStatus,
} from '@/lib/api/entitlements';
import { useAuthStore } from '@/lib/stores/auth-store';
import { usePlatform } from '@/lib/platform/use-platform';
import { useIsOnline } from '@/lib/offline/status/use-offline-status';
import { loadPlugin } from '@/lib/platform/native';
import { haptic } from '@/lib/native/native-haptics';
import {
  purchaseFull,
  recheckEntitlements,
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
import { outcomeMessage, type FlowState, type Message } from '@/lib/entitlements/view-model';
import { closeUpgradeSheet, useUpgradeSheetStore } from '@/lib/entitlements/upgrade-sheet-store';
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

interface AppLike {
  addListener(
    event: 'appStateChange',
    cb: (s: { isActive: boolean }) => void
  ): Promise<{ remove(): Promise<void> | void }>;
}

const UNLOCKED_KINDS = ['unlocked', 'restored'];

function refreshEntitlementQueries(): void {
  void queryClient.invalidateQueries({ queryKey: ENTITLEMENT_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: queryKeys.pantry.all });
}

function flowAfter(kind: string): FlowState {
  if (kind === 'unlocked') return 'success';
  if (kind === 'verify-pending') return 'verify-pending';
  return 'idle';
}

function notifyUnlocked(): void {
  haptic('success');
  const { onUnlocked } = useUpgradeSheetStore.getState();
  if (!onUnlocked) return;
  closeUpgradeSheet();
  onUnlocked();
}

export function useEntitlement(): UseEntitlement {
  const { native } = usePlatform();
  const online = useIsOnline();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const signedIn = useAuthStore((s) => s.isAuthenticated);
  const { product, productError, retryProduct, getDeps } = useStoreProduct();
  const [flow, setFlow] = useState<FlowState>('idle');
  const [message, setMessage] = useState<Message>(null);

  const query = useQuery({
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
  const me = query.data;
  const statusRef = useRef<EntitlementStatus>('none');
  const currentStatus = me?.status ?? 'none';
  useEffect(() => {
    statusRef.current = currentStatus;
  }, [currentStatus]);

  const recheck = useCallback(async () => {
    const deps = await getDeps();
    if (!deps) return;
    const result = await recheckEntitlements(deps, statusRef.current);
    if (result === 'verified') refreshEntitlementQueries();
  }, [getDeps]);

  useEffect(() => {
    if (!native || !signedIn || !online) return;
    void recheck();
  }, [native, signedIn, online, recheck]);

  useEffect(() => {
    if (!native || !signedIn) return;
    let remove: (() => void) | undefined;
    let disposed = false;
    void loadPlugin(() => import('@capacitor/app') as unknown as Promise<{ App: AppLike }>).then(
      async (mod) => {
        if (!mod || disposed) return;
        const handle = await mod.App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) void recheck();
        });
        remove = () => void handle.remove();
        if (disposed) remove();
      }
    );
    return () => {
      disposed = true;
      remove?.();
    };
  }, [native, signedIn, recheck]);

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
