import { notifyManager, type QueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/stores/auth-store';
import type { apiClient } from '@/lib/api/client';
import { foodApi } from '@/lib/api/food';
import { syncApi } from '@/lib/api/sync';
import type { PantryItem } from '@/types/pantry.types';
import { createBarcodeCache, type BarcodeCache } from './barcode/barcode-cache';
import { createPendingScans, type PendingScans } from './barcode/pending-scan';
import { resolvePendingScans } from './barcode/resolve-pending';
import { PANTRY_ALL_KEY } from './cache/cache-keys';
import { fetchBootstrapSnapshot } from './cache/bootstrap-client';
import { createQueryPersister, type QueryPersister } from './cache/query-persister';
import { applySnapshot } from './cache/seed';
import { createConnectivity, type Connectivity } from './connectivity/connectivity';
import { isForcedOffline } from './connectivity/forced-offline';
import { createDrainWorker, type DrainEvent, type DrainWorker } from './outbox/drain';
import { createExecutorRegistry, type Executor } from './outbox/executors';
import { isInDoubt } from './outbox/fold';
import type { NewOp, OpKind, OutboxOp } from './outbox/op-types';
import { createOutboxStore, type EnqueueOpts, type OutboxStore } from './outbox/store';
import { applyResult, type CacheWrites } from './reconcile/apply-result';
import { foldEntityTypes, reapplyForKey } from './reconcile/reapply';
import { applyUserTransition } from './session/apply-transition';
import { consumeSessionEndIntent, registerSessionHandlers } from './session/session-hooks';
import { planUserTransition } from './session/user-scope';
import { readCacheMeta } from './cache/cache-meta';
import type { SqlDb } from './sql/types';
import { createTransport } from './transport';

export type RefreshResult = 'ok' | 'offline' | 'skipped' | 'error';

export interface OfflineRuntime {
  store: OutboxStore;
  persister: QueryPersister;
  connectivity: Connectivity;
  drain: DrainWorker;
  barcode: { cache: BarcodeCache; pending: PendingScans };
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
  // Persist only server-confirmed data for folded keys: while related ops are pending the cache
  // holds their optimistic effect, and boot re-folds pending ops, which would double-apply deltas
  // such as pantry.adjust. Keys no op folds into (recipes, preferences...) always persist.
  let enqueuing = 0;
  const persister = createQueryPersister({
    db,
    queryClient,
    getUserId,
    now,
    canPersist: async (key) => {
      const types = foldEntityTypes(key);
      if (types.length === 0) return true;
      // A pending mutation may already hold optimistic state whose op is not in the outbox yet.
      if (enqueuing > 0 || queryClient.isMutating() > 0) return false;
      const userId = getUserId();
      return !userId || !(await store.list(userId)).some((o) => types.includes(o.entityType));
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
  let extras: Readonly<Partial<Record<OpKind, Executor>>> = {};
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

  // Bumped on every signed-in user change so an in-flight refresh can tell its session ended.
  let sessionEpoch = 0;
  const MAX_REFRESH_FETCHES = 3;

  /** Fetches a snapshot no op completed during (else it may predate an applied change). */
  const fetchStableSnapshot = async (userId: string) => {
    for (let attempt = 1; ; attempt += 1) {
      const before = await store.list(userId);
      const snapshot = await fetchBootstrapSnapshot(fetchPage);
      const ops = await store.list(userId);
      const after = new Set(ops.map((o) => o.seq));
      const completedDuringFetch = before.some((o) => !after.has(o.seq));
      if (!completedDuringFetch || attempt >= MAX_REFRESH_FETCHES) return { snapshot, ops };
    }
  };

  const doRefresh = async (): Promise<RefreshResult> => {
    const userId = getUserId();
    if (!userId) return 'skipped';
    const epoch = sessionEpoch;
    if (!(await connectivity.isReachable())) return 'offline';
    try {
      // An op that may already be on the server would be folded twice over a fresh snapshot:
      // replay it (idempotent) first, and do not apply a snapshot while any is still in doubt.
      if ((await store.list(userId)).some(isInDoubt)) {
        drain.kick('refresh');
        await drain.whenIdle();
        if ((await store.list(userId)).some(isInDoubt)) return 'skipped';
      }
      const { snapshot, ops } = await fetchStableSnapshot(userId);
      // The user signed out or switched while fetching: never write their data into the new session.
      if (disposed || getUserId() !== userId || sessionEpoch !== epoch) return 'skipped';
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

  const barcode = { cache: createBarcodeCache({ db, now }), pending: createPendingScans({ db, now }) };
  let resolvingScans = false;

  // Resolves unknown scans saved offline once a drain finishes while online (fill blanks only).
  const resolveScans = async (): Promise<void> => {
    const userId = getUserId();
    const items = queryClient.getQueryData<PantryItem[]>(PANTRY_ALL_KEY);
    if (resolvingScans || !userId || !items || connectivity.getState() === 'offline') return;
    resolvingScans = true;
    try {
      const list = await barcode.pending.listUnresolved(userId);
      if (list.length === 0) return;
      const queued = new Set((await store.list(userId)).map((o) => o.entityId));
      await resolvePendingScans({
        pending: barcode.pending,
        list,
        cache: barcode.cache,
        userId,
        lookup: (code) => foodApi.lookupBarcode(code),
        getItem: (id) => items.find((i) => i.id === id),
        isCreatePending: (id) => queued.has(id),
        enqueue: (op) => runtime.enqueue(op),
      });
    } catch (error) {
      console.error('Pending scan resolution failed:', error instanceof Error ? error.name : 'unknown');
    } finally {
      resolvingScans = false;
    }
  };

  const handleEvent = (e: DrainEvent): void => {
    if (e.type === 'finished') void resolveScans();
    if (e.type === 'applied') {
      applyWrites(applyResult(e.op, e.result, e.remaining));
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

  const runtime: OfflineRuntime = {
    store,
    persister,
    connectivity,
    drain,
    barcode,
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
      extras = { ...extras, ...extra };
    },
    applyWrites,
    dispose() {
      detachSession();
      disposed = true;
      drain.dispose();
      connectivity.dispose();
      listeners.clear();
    },
  };
  const detachSession = attachSessionTransitions(runtime, args, () => {
    sessionEpoch += 1;
  });
  return runtime;
}

/**
 * Keeps the persister suspended around session clears, then applies the planned transition
 * (park/wipe/hydrate/resume) whenever the signed-in user id changes.
 */
function attachSessionTransitions(runtime: OfflineRuntime, args: CreateRuntimeArgs, onUserChanged: () => void): () => void {
  const { db, queryClient, getUserId, persister } = { ...args, persister: runtime.persister };
  let lastUserId = getUserId();
  let active = 0;
  let chain: Promise<void> = Promise.resolve();

  registerSessionHandlers({
    beforeClear: () => persister.suspend(),
    afterClear: () => {
      // A user id change follows synchronously; if none does, nothing else will resume us.
      queueMicrotask(() => {
        if (active === 0) persister.resume();
      });
    },
  });

  const onUserChange = (next: string | null): void => {
    if (next === lastUserId) return;
    const prev = lastUserId;
    lastUserId = next;
    onUserChanged();
    const intent = consumeSessionEndIntent();
    active += 1;
    chain = chain
      .then(async () => {
        const meta = await readCacheMeta(db);
        const plan = planUserTransition({ prevUserId: prev, nextUserId: next, metaUserId: meta.userId, intent });
        await applyUserTransition(runtime, queryClient, db, plan);
      })
      .catch((error: unknown) => {
        console.error('Session transition failed:', error instanceof Error ? error.name : 'unknown');
      })
      .finally(() => {
        active -= 1;
        if (active === 0) persister.resume();
      });
  };

  const unsubscribe = useAuthStore.subscribe((state) => onUserChange(state.user?.id ?? null));
  return () => {
    unsubscribe();
    registerSessionHandlers(null);
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
