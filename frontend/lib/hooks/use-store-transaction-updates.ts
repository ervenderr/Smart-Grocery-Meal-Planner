'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useIsOnline } from '@/lib/offline/status/use-offline-status';
import { getStoreDeps } from '@/lib/native/store/store-deps';
import { subscribeTransactionUpdates } from '@/lib/native/store/store-service';
import { refreshEntitlementQueries } from '@/lib/entitlements/refresh';

/**
 * Listens to StoreKit Transaction.updates (Ask-to-Buy approvals, interrupted
 * purchases, other devices, refunds) for the signed-in user (WR-04). Each
 * delivery is verified with the server and finished; a verified result refreshes
 * /entitlements/me. Mount once, app-wide, on native only.
 */
export function useStoreTransactionUpdates(enabled: boolean): void {
  const signedIn = useAuthStore((s) => s.isAuthenticated);
  const online = useIsOnline();
  const onlineRef = useRef(online);
  useEffect(() => {
    onlineRef.current = online;
  }, [online]);

  useEffect(() => {
    if (!enabled || !signedIn) return;
    let unsubscribe: (() => void) | undefined;
    let disposed = false;
    void (async () => {
      const deps = await getStoreDeps(() => onlineRef.current);
      if (!deps || disposed) return;
      const stop = await subscribeTransactionUpdates(deps, (result) => {
        if (result === 'verified') refreshEntitlementQueries();
      });
      if (disposed) stop();
      else unsubscribe = stop;
    })();
    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, [enabled, signedIn]);
}
