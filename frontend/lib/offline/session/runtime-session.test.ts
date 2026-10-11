import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/stores/auth-store';
import { PANTRY_ALL_KEY } from '../cache/cache-keys';
import { ID_A } from '../outbox/fixtures.test-helper';
import { createOfflineRuntime, type OfflineRuntime } from '../runtime';
import { migrate } from '../sql/migrations';
import { createNodeSqlDb } from '../sql/node-sqldb.test-helper';
import type { SqlDb } from '../sql/types';
import { setSessionEndIntent } from './session-hooks';

let db: SqlDb & { close(): void };
let qc: QueryClient;
let rt: OfflineRuntime;
const user = (id: string) => ({ id, email: `${id}@x.io` }) as never;
const rows = async () => (await db.query<{ n: number }>('SELECT COUNT(*) AS n FROM cache_entries'))[0].n;
const settle = () => new Promise((r) => setTimeout(r, 30));

beforeEach(async () => {
  db = createNodeSqlDb();
  await migrate(db);
  qc = new QueryClient();
  useAuthStore.setState({ user: null, token: null, isAuthenticated: false });
  rt = createOfflineRuntime({
    db,
    queryClient: qc,
    getUserId: () => useAuthStore.getState().user?.id ?? null,
    transportClient: { post: vi.fn(), patch: vi.fn(), delete: vi.fn() } as never,
    probe: async () => false,
    fetchPage: async () => ({}),
  });
  rt.persister.start();
  useAuthStore.getState().setAuth('t', user('A'));
  await settle();
  qc.setQueryData(PANTRY_ALL_KEY, [{ id: ID_A, quantity: 5 }]);
  await rt.persister.flush();
  await rt.store.enqueue('A', { kind: 'pantry.adjust', label: 'Rice', payload: { id: ID_A, delta: 1 } });
});
afterEach(() => {
  rt.dispose();
  qc.clear();
  db.close();
});

describe('runtime session transitions', () => {
  it('expiry keeps cache rows and ops; the same user resumes them', async () => {
    useAuthStore.getState().clearAuth();
    await settle();
    expect(await rows()).toBe(1);
    expect((await rt.store.list('A'))[0].state).toBe('paused_auth');
    useAuthStore.getState().setAuth('t', user('A'));
    await settle();
    expect((await rt.store.list('A'))[0].state).not.toBe('paused_auth');
    expect(await rows()).toBe(1);
  });

  it('logout wipes the cache but keeps ops', async () => {
    setSessionEndIntent('logout');
    useAuthStore.getState().clearAuth();
    await settle();
    expect(await rows()).toBe(0);
    expect(await rt.store.list('A')).toHaveLength(1);
  });

  it('account deletion removes ops and cache', async () => {
    setSessionEndIntent('deleted');
    useAuthStore.getState().clearAuth();
    await settle();
    expect(await rows()).toBe(0);
    expect(await rt.store.list('A')).toHaveLength(0);
  });

  it('a different user never sees the previous cache or ops', async () => {
    useAuthStore.getState().clearAuth();
    useAuthStore.getState().setAuth('t', user('B'));
    await settle();
    expect(await rows()).toBe(0);
    expect(await rt.store.list('B')).toHaveLength(0);
    expect(await rt.store.list('A')).toHaveLength(1);
  });
});
