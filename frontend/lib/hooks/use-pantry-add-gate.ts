'use client';

import { useCallback, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { entitlementsApi, ENTITLEMENT_QUERY_KEY } from '@/lib/api/entitlements';
import { PANTRY_ALL_KEY } from '@/lib/offline/cache/cache-keys';
import { useAuthStore } from '@/lib/stores/auth-store';
import { usePlatform } from '@/lib/platform/use-platform';
import { useIsOnline } from '@/lib/offline/status/use-offline-status';
import { decidePantryAdd } from '@/lib/entitlements/pantry-gate';
import { freeLimitOf, isUpgradeRequired, upgradeLimitFrom } from '@/lib/entitlements/upgrade-error';
import { openUpgradeSheet } from '@/lib/entitlements/upgrade-sheet-store';
import { ENTITLEMENT_COPY } from '@/lib/entitlements/copy';
import type { PantryItem } from '@/types/pantry.types';

export interface PantryAddGate {
  /** Inline limit message for web (null when none). */
  limitError: string | null;
  clearLimitError(): void;
  /**
   * Pre-check before saving. Returns true when the add was intercepted (sheet opened or
   * inline message set) and the caller must stop without resetting the form.
   */
  intercept(returnFocus: HTMLElement | null, retry: () => void): boolean;
  /** Handles a server 403 UPGRADE_REQUIRED. Returns true when it was handled. */
  handleError(error: unknown, returnFocus: HTMLElement | null, retry: () => void): boolean;
}

/**
 * Free-tier limit handling for the Add Item form. Cached entitlement and count are
 * hints only; the server's 403 stays authoritative.
 */
export function usePantryAddGate(): PantryAddGate {
  const queryClient = useQueryClient();
  const { native } = usePlatform();
  const online = useIsOnline();
  const signedIn = useAuthStore((s) => s.isAuthenticated);
  const [limitError, setLimitError] = useState<string | null>(null);
  const bypassRef = useRef(false);

  const { data: me } = useQuery({
    queryKey: ENTITLEMENT_QUERY_KEY,
    queryFn: entitlementsApi.me,
    staleTime: 5 * 60_000,
    enabled: signedIn,
  });

  const openSheet = useCallback(
    (returnFocus: HTMLElement | null, retry: () => void) =>
      openUpgradeSheet({
        returnFocus,
        onUnlocked: () => {
          // The entitlement is now active; skip the (possibly stale) local pre-check once.
          bypassRef.current = true;
          retry();
        },
      }),
    []
  );

  const intercept = useCallback<PantryAddGate['intercept']>(
    (returnFocus, retry) => {
      if (bypassRef.current) {
        bypassRef.current = false;
        return false;
      }
      const decision = decidePantryAdd({
        native,
        online,
        entitlementStatus: me?.status,
        pantryLimit: me?.limits.pantry,
        activeCount: queryClient.getQueryData<PantryItem[]>(PANTRY_ALL_KEY)?.length,
      });
      if (decision === 'upgrade') {
        openSheet(returnFocus, retry);
        return true;
      }
      if (decision === 'web-limit') {
        setLimitError(ENTITLEMENT_COPY.webLimitInline(freeLimitOf(me?.limits.pantry)));
        return true;
      }
      return false;
    },
    [native, online, me, queryClient, openSheet]
  );

  const handleError = useCallback<PantryAddGate['handleError']>(
    (error, returnFocus, retry) => {
      if (!isUpgradeRequired(error)) return false;
      if (native) openSheet(returnFocus, retry);
      else setLimitError(ENTITLEMENT_COPY.webLimitInline(upgradeLimitFrom(error)));
      return true;
    },
    [native, openSheet]
  );

  const clearLimitError = useCallback(() => setLimitError(null), []);

  return { limitError, clearLimitError, intercept, handleError };
}
