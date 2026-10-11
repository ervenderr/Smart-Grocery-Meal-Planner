import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { clearUserSessionState } from '@/lib/auth/session-cleanup';
import { PANTRY_ALL_KEY } from '../cache/cache-keys';
import { readCacheMeta, writeCacheMeta } from '../cache/cache-meta';
import { createQueryPersister } from '../cache/query-persister';
import { ID_A } from '../outbox/fixtures.test-helper';
import { createOutboxStore, type OutboxStore } from '../outbox/store';
import { migrate } from '../sql/migrations';
import { createNodeSqlDb } from '../sql/node-sqldb.test-helper';
import type { SqlDb } from '../sql/types';
import { applyUserTransition, type TransitionRuntime } from './apply-transition';
import { notifySessionCleared, notifySessionClearing, registerSessionHandlers } from './session-hooks';
import { planUserTransition } from './user-scope';

let db: SqlDb & { close(): void };
let qc: QueryClient;
let store: OutboxStore;
let userId: string | null;
let runtime: TransitionRuntime;
const refresh = vi.fn(async () => 'ok' as const);
const kick = vi.fn();

const adjust = { kind: 'pantry.adjust', label: 'Rice', payload: { id: ID_A, delta: 2 } } as const;
const cacheRows = async () => (await db.query<{ n: number }>('SELECT COUNT(*) AS n FROM cache_entries'))[0].n;

beforeEach(async () => {
  db = createNodeSqlDb();
  await migrate(db);
  qc = new QueryClient();
  userId = 'A';
  store = createOutboxStore({ db });
  const persister = createQueryPersister({ db, queryClient: qc, getUserId: () => userId, writeDelayMs: 0 });
  runtime = { store, persister, drain: { kick } as never, refreshFromServer: refresh };
  persister.start();
  qc.setQueryData(PANTRY_ALL_KEY, [{ id: ID_A, quantity: 5 }]);
  await persister.flush();
  await writeCacheMeta(db, { userId: 'A' });
  await store.enqueue('A', adjust);
  refresh.mockClear();
  kick.mockClear();
});
afterEach(() => {
  registerSessionHandlers(null);
  qc.clear();
  db.close();
});

const run = async (prev: string | null, next: string | null, intent: 'expired' | 'logout' | 'deleted') => {
  const meta = (await readCacheMeta(db)).userId;
  runtime.persister.suspend();
  qc.clear();
  userId = next;
  await applyUserTransition(runtime, qc, db, planUserTransition({ prevUserId: prev, nextUserId: next, metaUserId: meta, intent }));
  runtime.persister.resume();
};

describe('applyUserTransition', () => {
  it('expired keeps cache rows and parks the ops as paused_auth', async () => {
    await run('A', null, 'expired');
    expect(await cacheRows()).toBe(1);
    expect((await store.list('A'))[0].state).toBe('paused_auth');
  });

  it('same user re-login hydrates, folds, resumes ops and refreshes', async () => {
    await run('A', null, 'expired');
    await run(null, 'A', 'expired');
    const ops = await store.list('A');
    expect(ops).toHaveLength(1);
    expect(ops[0].state).toBe('queued');
    expect(qc.getQueryData(PANTRY_ALL_KEY)).toEqual([{ id: ID_A, quantity: 7 }]);
    expect(refresh).toHaveBeenCalledWith('login');
    expect(kick).toHaveBeenCalled();
  });

  it('a different user wipes cache rows, keeps the old ops and sees an empty list', async () => {
    await run('A', null, 'expired');
    await run(null, 'B', 'expired');
    expect(await cacheRows()).toBe(0);
    expect(qc.getQueryData(PANTRY_ALL_KEY)).toBeUndefined();
    expect(await store.list('B')).toEqual([]);
    expect(await store.list('A')).toHaveLength(1);
    expect((await readCacheMeta(db)).userId).toBe('B');
  });

  it('logout wipes the cache and keeps the ops', async () => {
    await run('A', null, 'logout');
    expect(await cacheRows()).toBe(0);
    expect((await readCacheMeta(db)).userId).toBeNull();
    expect(await store.list('A')).toHaveLength(1);
  });

  it('deleted removes that user ops and the cache, not other users', async () => {
    await store.enqueue('B', adjust);
    await run('A', null, 'deleted');
    expect(await cacheRows()).toBe(0);
    expect(await store.list('A')).toEqual([]);
    expect(await store.list('B')).toHaveLength(1);
  });

  it('first sign-in with no meta user records it and keeps cache', async () => {
    await db.run(`DELETE FROM cache_meta WHERE key = 'user_id'`);
    await run(null, 'A', 'expired');
    expect((await readCacheMeta(db)).userId).toBe('A');
    expect(await cacheRows()).toBe(1);
  });
});

describe('regression: queryClient.clear during session changes', () => {
  it('clearUserSessionState with the persister suspended leaves cache_entries intact', async () => {
    registerSessionHandlers({ beforeClear: () => runtime.persister.suspend(), afterClear: () => undefined });
    notifySessionClearing();
    clearUserSessionState(qc);
    notifySessionCleared();
    await runtime.persister.flush();
    expect(await cacheRows()).toBe(1);
  });

  it('even without suspension an in-memory clear keeps rows; only wipe deletes them (CR-05)', async () => {
    clearUserSessionState(qc);
    await runtime.persister.flush();
    expect(await cacheRows()).toBe(1);
  });

  it('an expire-style transition never deletes outbox rows', async () => {
    const spy = vi.spyOn(store, 'deleteForUser');
    const discard = vi.spyOn(store, 'discard');
    await run('A', null, 'expired');
    await run(null, 'A', 'expired');
    expect(spy).not.toHaveBeenCalled();
    expect(discard).not.toHaveBeenCalled();
    expect(await store.list('A')).toHaveLength(1);
  });
});
