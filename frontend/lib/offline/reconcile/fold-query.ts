import { useAuthStore } from '@/lib/stores/auth-store';
import type { OutboxStore } from '../outbox/store';
import { getOfflineRuntime } from '../runtime';
import { reapplyForKey } from './reapply';

export interface FoldSource {
  store: Pick<OutboxStore, 'list'> | null;
  userId: string | null;
}

const liveSource = (): FoldSource => ({
  store: getOfflineRuntime()?.store ?? null,
  userId: useAuthStore.getState().user?.id ?? null,
});

/**
 * Re-applies the user's pending outbox ops over fresh server data for a canonical key, so a plain
 * refetch never drops the optimistic overlay (a later absolute edit would otherwise compute its
 * delta from the wrong base). Web (no runtime) and an empty outbox return the data unchanged.
 */
export async function foldPendingOver<T>(key: readonly unknown[], data: T, source: FoldSource = liveSource()): Promise<T> {
  if (!source.store || !source.userId) return data;
  const ops = await source.store.list(source.userId);
  return ops.length === 0 ? data : (reapplyForKey(key, data, ops) as T);
}

/** Wraps a canonical query function so its server result is folded with pending ops. */
export const withPendingOps =
  <T>(key: readonly unknown[], fetcher: () => Promise<T>) =>
  async (): Promise<T> =>
    foldPendingOver(key, await fetcher());
