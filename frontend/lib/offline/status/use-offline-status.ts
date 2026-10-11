'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { useAuthStore } from '@/lib/stores/auth-store';
import type { EntityType } from '../outbox/op-types';
import { getOfflineRuntime, type OfflineRuntime } from '../runtime';
import { createStatusSource, type StatusSnapshot, type StatusSource } from './status-source';

const sources = new WeakMap<OfflineRuntime, StatusSource>();
const getUserId = (): string | null => useAuthStore.getState().user?.id ?? null;
const noopSubscribe = (): (() => void) => () => undefined;
const nullSnapshot = (): null => null;

function sourceFor(runtime: OfflineRuntime): StatusSource {
  const existing = sources.get(runtime);
  if (existing) return existing;
  const created = createStatusSource(runtime, getUserId);
  sources.set(runtime, created);
  return created;
}

/** Null on web (no offline runtime): nothing should render. */
export function useOfflineStatus(): StatusSnapshot | null {
  const runtime = getOfflineRuntime();
  const source = useMemo(() => (runtime ? sourceFor(runtime) : null), [runtime]);
  return useSyncExternalStore(
    source ? source.subscribe : noopSubscribe,
    source ? source.getSnapshot : nullSnapshot,
    nullSnapshot,
  );
}

export function useIsOnline(): boolean {
  const status = useOfflineStatus();
  return status ? status.connectivity !== 'offline' : true;
}

const EMPTY: ReadonlyMap<string, 'pending' | 'failed'> = new Map();

export function usePendingEntityStates(entityType: EntityType): ReadonlyMap<string, 'pending' | 'failed'> {
  const status = useOfflineStatus();
  return useMemo(() => {
    if (!status) return EMPTY;
    const map = new Map<string, 'pending' | 'failed'>();
    for (const op of status.ops) {
      if (op.entityType !== entityType) continue;
      if (op.state === 'failed') map.set(op.entityId, 'failed');
      else if (map.get(op.entityId) !== 'failed') map.set(op.entityId, 'pending');
    }
    return map;
  }, [status, entityType]);
}
