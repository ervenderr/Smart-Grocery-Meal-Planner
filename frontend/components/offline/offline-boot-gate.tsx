'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { whenTokenStorageReady } from '@/lib/api/token-storage';
import { API_BASE_URL } from '@/lib/constants/api-routes';
import { useAuthStore } from '@/lib/stores/auth-store';
import { bootOffline, type BootResult } from '@/lib/offline/boot';
import { healthUrl, probeHealth } from '@/lib/offline/connectivity/probe';
import { getOfflineRuntime, createOfflineRuntime, whenOfflineRuntime } from '@/lib/offline/runtime';
import { getDb } from '@/lib/offline/sql/get-db';
import { attachTriggers } from '@/lib/offline/triggers';
import { isNativeBuild } from '@/lib/platform/native';
import { FirstLaunchOffline } from './first-launch-offline';

type Phase = 'booting' | 'ready' | 'empty-offline';

const getUserId = (): string | null => useAuthStore.getState().user?.id ?? null;

/**
 * Hydrates the offline cache before first render on native. On web builds it is a
 * pass-through (the check is a build-time constant, so server and client agree).
 */
export function OfflineBootGate({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<Phase>(isNativeBuild() ? 'booting' : 'ready');
  const started = useRef(false);

  useEffect(() => {
    if (!isNativeBuild() || started.current) return;
    started.current = true;
    let detach: (() => void) | null = null;
    let stopWaiting: (() => void) | null = null;
    let cancelled = false;

    void bootOffline({
      queryClient,
      getDb,
      getUserId,
      waitForAuth: whenTokenStorageReady,
      createRuntime: (db) =>
        createOfflineRuntime({
          db,
          queryClient,
          getUserId,
          transportClient: apiClient,
          probe: () => probeHealth({ fetchImpl: fetch, url: healthUrl(API_BASE_URL) }),
        }),
    }).then(async (result: BootResult) => {
      if (cancelled) return;
      setPhase(result.status === 'empty-offline' ? 'empty-offline' : 'ready');
      // A boot that hit the fail-open timeout still sets the runtime later; attach then.
      stopWaiting = whenOfflineRuntime((runtime) => {
        void attachTriggers(runtime).then((remove) => {
          if (cancelled) remove();
          else detach = remove;
        });
        void runtime.refreshFromServer('boot');
      });
    });

    return () => {
      cancelled = true;
      stopWaiting?.();
      detach?.();
    };
  }, [queryClient]);

  const retry = useCallback(() => {
    const runtime = getOfflineRuntime();
    if (!runtime) return;
    void runtime.refreshFromServer('retry').then((r) => {
      if (r === 'ok') setPhase('ready');
    });
  }, []);

  if (phase === 'booting') return null;
  if (phase === 'empty-offline') return <FirstLaunchOffline onRetry={retry} />;
  return <>{children}</>;
}
