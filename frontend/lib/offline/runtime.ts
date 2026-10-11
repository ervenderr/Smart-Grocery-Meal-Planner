import { notifyManager, type QueryClient } from '@tanstack/react-query';
import type { apiClient } from '@/lib/api/client';
import { syncApi } from '@/lib/api/sync';
import { fetchBootstrapSnapshot } from './cache/bootstrap-client';
import { createQueryPersister, type QueryPersister } from './cache/query-persister';
import { applySnapshot } from './cache/seed';
import { createConnectivity, type Connectivity } from './connectivity/connectivity';
import { isForcedOffline } from './connectivity/forced-offline';
import { createDrainWorker, type DrainEvent, type DrainWorker } from './outbox/drain';
import { createExecutorRegistry, type Executor } from './outbox/executors';
import type { NewOp, OpKind, OutboxOp } from './outbox/op-types';
import { createOutboxStore, type EnqueueOpts, type OutboxStore } from './outbox/store';
import { applyResult, type CacheWrites } from './reconcile/apply-result';
import { reapplyForKey } from './reconcile/reapply';
import type { SqlDb } from './sql/types';
import { createTransport } from './transport';

export type RefreshResult = 'ok' | 'offline' | 'skipped' | 'error';

export interface OfflineRuntime {
  store: OutboxStore;
  persister: QueryPersister;
  connectivity: Connectivity;
  drain: DrainWorker;
  enqueue(op: NewOp, opts?: EnqueueOpts): Promise<OutboxOp | null>;
  refreshFromServer(reason: string): Promise<RefreshResult>;
  onEvent(listener: (e: DrainEvent) => void): () => void;
  registerExecutors(extra: Partial<Record<OpKind, Executor>>): void;
  applyWrites(writes: CacheWrites): void;
  dispose(): void;
}

export interface CreateRuntimeArgs {
  db: SqlDb;
  queryClient: QueryClient;
  getUserId: () => string | null;
  transportClient: Pick<typeof apiClient, 'post' | 'patch' | 'delete'>;
  probe: () => Promise<boolean>;
  now?: () => number;
  fetchPage?: (cursor: string | null) => Promise<unknown>;
}

export function createOfflineRuntime(args: CreateRuntimeArgs): OfflineRuntime {
  const { db, queryClient, getUserId } = args;
  const now = args.now ?? Date.now;
  const fetchPage = args.fetchPage ?? ((cursor: string | null) => syncApi.bootstrap(cursor));
  const store = createOutboxStore({ db, now });
  // Persist only server-confirmed data: while ops are pending the cache holds their optimistic
  // effect, and boot re-folds pending ops, which would double-apply deltas such as pantry.adjust.
  let enqueuing = 0;
  const persister = createQueryPersister({
    db,
    queryClient,
    getUserId,
    now,
    canPersist: async () => {
      if (enqueuing > 0) return false;
      const userId = getUserId();
      return !userId || (await store.list(userId)).length === 0;
    },
  });
  const connectivity = createConnectivity({
    probe: args.probe,
    isForcedOffline: () => isForcedOffline(),
    now,
  });
  const transport = createTransport({
    client: args.transportClient,
    isOffline: () => connectivity.getState() === 'offline',
    onNetworkFailure: () => connectivity.reportNetworkFailure(),
    onSuccess: () => connectivity.reportSuccess(),
  });
  const extras: Partial<Record<OpKind, Executor>> = {};
  const defaults = createExecutorRegistry();
  const registry = { get: (kind: OpKind) => extras[kind] ?? defaults.get(kind) };
  const listeners = new Set<(e: DrainEvent) => void>();
  let inflight: Promise<RefreshResult> | null = null;
  let disposed = false;

  const applyWrites = (writes: CacheWrites): void => {
    if (writes.length === 0) return;
    notifyManager.batch(() => {
      for (const w of writes) {
        queryClient.setQueryData(w.key as unknown[], (old: unknown) => w.update(old));
      }
    });
  };

  const doRefresh = async (): Promise<RefreshResult> => {
    const userId = getUserId();
    if (!userId) return 'skipped';
    if (!(await connectivity.isReachable())) return 'offline';
    try {
      const snapshot = await fetchBootstrapSnapshot(fetchPage);
      const ops = await store.list(userId);
      await applySnapshot({
        queryClient,
        snapshot,
        db,
        reapply: (key, data) => reapplyForKey(key, data, ops),
      });
      connectivity.reportSuccess();
      return 'ok';
    } catch (error) {
      console.error('Bootstrap refresh failed:', error instanceof Error ? error.name : 'unknown');
      return 'error';
    }
  };

  const refreshFromServer = (_reason: string): Promise<RefreshResult> => {
    if (disposed) return Promise.resolve('skipped');
    if (!inflight) {
      inflight = doRefresh().finally(() => {
        inflight = null;
      });
    }
    return inflight;
  };

  const handleEvent = (e: DrainEvent): void => {
    if (e.type === 'applied') {
      applyWrites(applyResult(e.op, e.result));
    } else if (e.type === 'finished' && e.applied > 0) {
      const userId = getUserId();
      if (userId) {
        void store.counts(userId).then((c) => {
          if (c.queued === 0 && c.inFlight === 0) void refreshFromServer('drained');
        });
      }
    }
    listeners.forEach((l) => l(e));
  };

  const drain = createDrainWorker({
    store,
    transport,
    executors: registry,
    connectivity,
    getUserId,
    now,
    onEvent: handleEvent,
  });

  return {
    store,
    persister,
    connectivity,
    drain,
    async enqueue(op, opts) {
      const userId = getUserId();
      if (!userId) throw new Error('Cannot enqueue offline change without a signed-in user');
      enqueuing += 1;
      try {
        const row = await store.enqueue(userId, op, opts);
        drain.kick('enqueue');
        return row;
      } finally {
        enqueuing -= 1;
      }
    },
    refreshFromServer,
    onEvent(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    registerExecutors(extra) {
      Object.assign(extras, extra);
    },
    applyWrites,
    dispose() {
      disposed = true;
      drain.dispose();
      listeners.clear();
    },
  };
}

let current: OfflineRuntime | null = null;
export const getOfflineRuntime = (): OfflineRuntime | null => current;
const readyListeners = new Set<(r: OfflineRuntime) => void>();
export const setOfflineRuntime = (r: OfflineRuntime | null): void => {
  current = r;
  if (r) [...readyListeners].forEach((l) => l(r));
};

/** Calls back now if the runtime exists, else once it is set (covers a boot that outlived its timeout). */
export function whenOfflineRuntime(cb: (r: OfflineRuntime) => void): () => void {
  if (current) {
    cb(current);
    return () => undefined;
  }
  readyListeners.add(cb);
  return () => {
    readyListeners.delete(cb);
  };
}
