import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { registerOfflineGate, isOfflineGateClosed } from '@/lib/api/offline-error';
import { createNodeSqlDb } from './sql/node-sqldb.test-helper';
import { migrate } from './sql/migrations';
import type { SqlDb } from './sql/types';
import { BOOT_TIMEOUT_MS, bootOffline, type BootResult } from './boot';
import { createOfflineRuntime, getOfflineRuntime, setOfflineRuntime, type OfflineRuntime } from './runtime';
import { createQueryPersister } from './cache/query-persister';
import { PANTRY_ALL_KEY } from './cache/cache-keys';
import { createOutboxStore } from './outbox/store';
import { ID_A } from './outbox/fixtures.test-helper';

let db: SqlDb & { close(): void };
let qc: QueryClient;
let online: boolean;
let userId: string | null;
let created: OfflineRuntime[];

const adjust = { kind: 'pantry.adjust', label: 'Rice', payload: { id: ID_A, delta: 2 } } as const;

const args = (over: Partial<Parameters<typeof bootOffline>[0]> = {}) => ({
  queryClient: qc,
  getDb: async () => db as SqlDb | null,
  getUserId: () => userId,
  waitForAuth: async () => ({ readFailed: false }),
  enabled: () => true,
  createRuntime: (d: SqlDb) => {
    const r = createOfflineRuntime({
      db: d,
      queryClient: qc,
      getUserId: () => userId,
      transportClient: { post: vi.fn(), patch: vi.fn(), delete: vi.fn() } as never,
      probe: async () => online,
      fetchPage: async () => ({}),
    });
    created.push(r);
    return r;
  },
  ...over,
});

async function seedPersisted(rows: unknown[]) {
  const qc1 = new QueryClient();
  const p = createQueryPersister({ db, queryClient: qc1, getUserId: () => userId, writeDelayMs: 0 });
  p.start();
  qc1.setQueryData(PANTRY_ALL_KEY, rows);
  await p.flush();
  p.suspend();
  qc1.clear();
}

beforeEach(async () => {
  db = createNodeSqlDb();
  await migrate(db);
  qc = new QueryClient();
  online = true;
  userId = 'u1';
  created = [];
});
afterEach(() => {
  created.forEach((r) => r.dispose());
  setOfflineRuntime(null);
  registerOfflineGate(null);
  vi.useRealTimers();
  qc.clear();
  db.close();
});

describe('bootOffline', () => {
  it('exports a 1500 ms timeout', () => {
    expect(BOOT_TIMEOUT_MS).toBe(1500);
  });

  it('is disabled when not enabled and never touches the db', async () => {
    const getDb = vi.fn(async () => db as SqlDb | null);
    expect(await bootOffline(args({ enabled: () => false, getDb }))).toEqual({ status: 'disabled' });
    expect(getDb).not.toHaveBeenCalled();
  });

  it('fails open when the db is unavailable', async () => {
    const r = await bootOffline(args({ getDb: async () => null }));
    expect(r).toEqual({ status: 'failed-open', reason: 'db-unavailable' });
  });

  it('fails open when boot throws', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await bootOffline(args({ getDb: async () => Promise.reject(new Error('boom')) }));
    expect(r).toEqual({ status: 'failed-open', reason: 'error' });
    spy.mockRestore();
  });

  it('resets in_flight ops to queued', async () => {
    const store = createOutboxStore({ db });
    const row = await store.enqueue('u1', adjust);
    await store.markInFlight(row!.seq);
    await seedPersisted([{ id: ID_A, quantity: 5 }]);
    await bootOffline(args());
    const ops = await created[0].store.list('u1');
    expect(ops[0].state).toBe('queued');
  });

  it('hydrates persisted rows and folds pending ops over them', async () => {
    await seedPersisted([{ id: ID_A, quantity: 5 }]);
    await createOutboxStore({ db }).enqueue('u1', adjust);
    const r = await bootOffline(args());
    expect(r).toEqual({ status: 'ready', restored: 1 });
    const data = qc.getQueryData(PANTRY_ALL_KEY) as { quantity: number }[];
    expect(data[0].quantity).toBe(7);
    expect(getOfflineRuntime()).toBe(created[0]);
  });

  it('registers the offline gate and native query defaults', async () => {
    online = false;
    await seedPersisted([{ id: ID_A, quantity: 5 }]);
    await bootOffline(args());
    await created[0].connectivity.isReachable();
    expect(isOfflineGateClosed()).toBe(true);
    expect(qc.getDefaultOptions().queries?.networkMode).toBe('offlineFirst');
  });

  it('returns no-user and hydrates nothing without a user', async () => {
    await seedPersisted([{ id: ID_A, quantity: 5 }]);
    userId = null;
    const r = await bootOffline(args());
    expect(r).toEqual({ status: 'no-user' });
    expect(qc.getQueryData(PANTRY_ALL_KEY)).toBeUndefined();
    expect(getOfflineRuntime()).toBe(created[0]);
  });

  it('returns empty-offline when nothing is cached and the server is unreachable', async () => {
    online = false;
    expect(await bootOffline(args())).toEqual({ status: 'empty-offline' });
  });

  it('returns ready with zero restored when online', async () => {
    expect(await bootOffline(args())).toEqual({ status: 'ready', restored: 0 });
  });

  it('fails open at the timeout when getDb is slow', async () => {
    vi.useFakeTimers();
    const slow = () => new Promise<SqlDb | null>(() => {});
    const p: Promise<BootResult> = bootOffline(args({ getDb: slow }));
    await vi.advanceTimersByTimeAsync(BOOT_TIMEOUT_MS);
    expect(await p).toEqual({ status: 'failed-open', reason: 'timeout' });
  });
});
