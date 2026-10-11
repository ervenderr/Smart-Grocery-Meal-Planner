'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { EntitlementStatus } from '@/lib/api/entitlements';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useIsOnline } from '@/lib/offline/status/use-offline-status';
import { loadPlugin } from '@/lib/platform/native';
import { getStoreDeps } from '@/lib/native/store/store-deps';
import { recheckEntitlements } from '@/lib/native/store/store-service';
import { refreshEntitlementQueries } from '@/lib/entitlements/refresh';
import {
  createRecheckController,
  RECHECK_MIN_INTERVAL_MS,
  type RecheckController,
  type RecheckTrigger,
} from '@/lib/entitlements/recheck-controller';
import { useEntitlementMeQuery } from './use-entitlement';

interface AppLike {
  addListener(
    event: 'appStateChange',
    cb: (s: { isActive: boolean }) => void
  ): Promise<{ remove(): Promise<void> | void }>;
}

/**
 * Launch/resume entitlement recheck (WR-07). Mount once, app-wide, on native.
 * Waits for /entitlements/me to load from the server (not the localStorage
 * placeholder), debounces resume/online triggers and stops after claimed-elsewhere.
 */
export function useEntitlementRecheck(enabled: boolean): void {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const online = useIsOnline();
  const query = useEntitlementMeQuery();
  const serverReady = query.isSuccess && !query.isPlaceholderData;
  const serverStatus: EntitlementStatus | null = serverReady ? query.data.status : null;

  const onlineRef = useRef(online);
  const statusRef = useRef<EntitlementStatus | null>(serverStatus);
  useEffect(() => {
    onlineRef.current = online;
    statusRef.current = serverStatus;
  }, [online, serverStatus]);

  // One controller per signed-in user, so a new account starts fresh.
  const controllerRef = useRef<RecheckController | null>(null);
  const startedForRef = useRef<string | null>(null);
  useEffect(() => {
    startedForRef.current = null;
    controllerRef.current =
      userId === null
        ? null
        : createRecheckController({
            run: async (status) => {
              const deps = await getStoreDeps(() => onlineRef.current, userId);
              return deps ? recheckEntitlements(deps, status) : 'skipped';
            },
            now: () => Date.now(),
            minIntervalMs: RECHECK_MIN_INTERVAL_MS,
          });
  }, [userId]);

  const enabledRef = useRef(enabled);
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const trigger = useCallback((reason: RecheckTrigger) => {
    const controller = controllerRef.current;
    const status = statusRef.current;
    if (!enabledRef.current || !controller || status === null || !onlineRef.current) return;
    void controller.trigger(reason, status).then((result) => {
      if (result === 'verified') refreshEntitlementQueries();
    });
  }, []);

  // First run once the server status is known; again when connectivity returns.
  useEffect(() => {
    if (!enabled || userId === null || !serverReady || !online) return;
    const first = startedForRef.current !== userId;
    startedForRef.current = userId;
    trigger(first ? 'mount' : 'online');
  }, [enabled, userId, serverReady, online, trigger]);

  useEffect(() => {
    if (!enabled || userId === null) return;
    let remove: (() => void) | undefined;
    let disposed = false;
    void loadPlugin(() => import('@capacitor/app') as unknown as Promise<{ App: AppLike }>).then(
      async (mod) => {
        if (!mod || disposed) return;
        const handle = await mod.App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) trigger('resume');
        });
        remove = () => void handle.remove();
        if (disposed) remove();
      }
    );
    return () => {
      disposed = true;
      remove?.();
    };
  }, [enabled, userId, trigger]);
}
