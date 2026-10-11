import { dehydrate, hydrate, type DehydratedState, type QueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import type { SqlDb } from '../sql/types';
import { isPersistedKey, keyHash } from './cache-keys';
import { wipeCache } from './cache-meta';

export interface QueryPersister {
  start(): () => void;
  hydrateAll(): Promise<{ restored: number; dropped: number }>;
  flush(): Promise<void>;
  suspend(): void;
  resume(): void;
  wipe(): Promise<void>;
}

export interface QueryPersisterOptions {
  db: SqlDb;
  queryClient: QueryClient;
  getUserId: () => string | null;
  now?: () => number;
  writeDelayMs?: number;
  /** When it resolves false the write of that key is skipped (it holds unconfirmed optimistic state). */
  canPersist?: (key: readonly unknown[]) => Promise<boolean>;
}

const GC_PREFIXES: readonly (readonly string[])[] = [
  ['pantry'],
  ['recipes'],
  ['mealPlans'],
  ['preferences'],
  ['shopping', 'active'],
  ['notifications', 'stats'],
];

const rowSchema = z.object({
  key_hash: z.string(),
  key_json: z.string(),
  state_json: z.string(),
});

const dehydratedQuerySchema = z.object({
  queryKey: z.array(z.unknown()),
  queryHash: z.string(),
  state: z
    .object({ data: z.unknown(), dataUpdatedAt: z.number(), status: z.literal('success') })
    .passthrough(),
});

const UPSERT = `INSERT INTO cache_entries (key_hash, key_json, state_json, user_id, updated_at)
VALUES (?, ?, ?, ?, ?)
ON CONFLICT(key_hash) DO UPDATE SET key_json = excluded.key_json,
state_json = excluded.state_json, user_id = excluded.user_id, updated_at = excluded.updated_at`;

export function createQueryPersister(opts: QueryPersisterOptions): QueryPersister {
  const { db, queryClient, getUserId } = opts;
  const now = opts.now ?? Date.now;
  const delay = opts.writeDelayMs ?? 150;
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const pendingKeys = new Map<string, readonly unknown[]>();
  let suspended = false;
  let chain: Promise<void> = Promise.resolve();

  const enqueue = (task: () => Promise<void>): void => {
    chain = chain.then(task).catch((err) => {
      console.warn('[offline] cache persist failed', err instanceof Error ? err.message : 'unknown');
    });
  };

  const deferred = new Map<string, readonly unknown[]>();

  const writeKey = async (key: readonly unknown[]): Promise<void> => {
    if (suspended) {
      // Mid session change: write once the transition settles (resume), never under a stale user.
      deferred.set(keyHash(key), key);
      return;
    }
    const userId = getUserId();
    if (!userId) return;
    const hash = keyHash(key);
    const query = queryClient.getQueryCache().find({ queryKey: key as unknown[], exact: true });
    if (!query || query.state.status !== 'success') return;
    // Snapshot first, then check: an optimistic write landing during the async check is then
    // either excluded from this snapshot or visible to the check (pending mutation / outbox op).
    const state = dehydrate(queryClient, {
      shouldDehydrateQuery: (q) => q.queryHash === query.queryHash,
    });
    const entry = state.queries[0];
    if (!entry) return;
    if (opts.canPersist && !(await opts.canPersist(key))) return;
    if (suspended) {
      deferred.set(hash, key);
      return;
    }
    if (getUserId() !== userId) return;
    const { queryKey, queryHash, state: s } = entry;
    const slim = { queryKey, queryHash, state: { data: s.data, dataUpdatedAt: s.dataUpdatedAt, status: s.status } };
    await db.run(UPSERT, [hash, JSON.stringify(key), JSON.stringify(slim), userId, now()]);
  };

  const fire = (hash: string): void => {
    const key = pendingKeys.get(hash);
    timers.delete(hash);
    pendingKeys.delete(hash);
    if (key) enqueue(() => writeKey(key));
  };

  const schedule = (key: readonly unknown[]): void => {
    const hash = keyHash(key);
    pendingKeys.set(hash, key);
    if (timers.has(hash)) return;
    timers.set(hash, setTimeout(() => fire(hash), delay));
  };

  const cancel = (hash: string): void => {
    const t = timers.get(hash);
    if (t) clearTimeout(t);
    timers.delete(hash);
    pendingKeys.delete(hash);
  };

  const start = (): (() => void) => {
    // Persisted data must outlive in-memory GC in every session, not only ones that ran hydrateAll.
    for (const prefix of GC_PREFIXES) queryClient.setQueryDefaults(prefix, { gcTime: Infinity });
    return queryClient.getQueryCache().subscribe((event) => {
      const key = event.query.queryKey;
      if (!isPersistedKey(key)) return;
      if (event.type === 'removed') {
        // A removal from memory (GC or clear) never deletes the on-disk row; only wipe() does.
        cancel(keyHash(key));
        deferred.delete(keyHash(key));
        return;
      }
      if (event.type === 'updated' && event.action.type === 'success') schedule(key);
    });
  };

  const hydrateAll = async (): Promise<{ restored: number; dropped: number }> => {
    const userId = getUserId();
    if (!userId) return { restored: 0, dropped: 0 };
    const rows = await db.query<unknown>(
      'SELECT key_hash, key_json, state_json FROM cache_entries WHERE user_id = ?',
      [userId],
    );
    const queries: DehydratedState['queries'] = [];
    let dropped = 0;
    for (const raw of rows) {
      try {
        const row = rowSchema.parse(raw);
        const parsed = dehydratedQuerySchema.parse(JSON.parse(row.state_json));
        queries.push(parsed as unknown as DehydratedState['queries'][number]);
      } catch {
        dropped += 1;
      }
    }
    for (const prefix of GC_PREFIXES) {
      queryClient.setQueryDefaults(prefix, { gcTime: Infinity });
    }
    hydrate(queryClient, { mutations: [], queries });
    if (dropped > 0) console.warn(`[offline] dropped ${dropped} invalid cache rows`);
    return { restored: queries.length, dropped };
  };

  const flush = async (): Promise<void> => {
    for (const hash of [...timers.keys()]) {
      clearTimeout(timers.get(hash));
      fire(hash);
    }
    await chain;
  };

  return {
    start,
    hydrateAll,
    flush,
    suspend: () => {
      suspended = true;
    },
    resume: () => {
      suspended = false;
      const keys = [...deferred.values()];
      deferred.clear();
      keys.forEach(schedule);
    },
    wipe: async () => {
      for (const hash of [...timers.keys()]) cancel(hash);
      deferred.clear();
      await chain;
      await wipeCache(db);
    },
  };
}
