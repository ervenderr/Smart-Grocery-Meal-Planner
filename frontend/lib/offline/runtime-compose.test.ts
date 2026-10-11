import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/stores/auth-store';
import { createNodeSqlDb } from './sql/node-sqldb.test-helper';
import { migrate } from './sql/migrations';
import type { SqlDb } from './sql/types';
import { createOfflineRuntime, type OfflineRuntime } from './runtime';
import { ID_A } from './outbox/fixtures.test-helper';

// IN-04: executor registration and dispose composition are immutable but behave the same.
let db: SqlDb & { close(): void };
let qc: QueryClient;
let rt: OfflineRuntime;
const settle = () => new Promise((r) => setTimeout(r, 20));

beforeEach(async () => {
  db = createNodeSqlDb();
  await migrate(db);
  qc = new QueryClient();
  useAuthStore.setState({ user: { id: 'u1' } as never, token: 't', isAuthenticated: true });
  rt = createOfflineRuntime({
    db,
    queryClient: qc,
    getUserId: () => useAuthStore.getState().user?.id ?? null,
    transportClient: { post: vi.fn(), patch: vi.fn(), delete: vi.fn() } as never,
    probe: async () => true,
    fetchPage: async () => ({}),
  });
});
afterEach(() => {
  rt.dispose();
  useAuthStore.setState({ user: null, token: null, isAuthenticated: false });
  qc.clear();
  db.close();
});

describe('runtime composition', () => {
  it('later registerExecutors calls add to earlier ones', async () => {
    const cook = vi.fn().mockResolvedValue({ ok: 1 });
    const finish = vi.fn().mockResolvedValue({ ok: 2 });
    rt.registerExecutors({ 'cook.apply': { run: cook } });
    rt.registerExecutors({ 'shopping.finish': { run: finish } });
    await rt.enqueue({ kind: 'cook.apply', label: 'Cook', payload: { target: { recipeId: ID_A }, servings: 1, occurredAt: '2026-02-02T00:00:00.000Z' } });
    await rt.enqueue({ kind: 'shopping.finish', label: 'Trip', payload: { input: { occurredAt: '2026-02-02T00:00:00.000Z', receiptDate: '2026-02-02' } } });
    await rt.drain.whenIdle();
    expect(cook).toHaveBeenCalledTimes(1);
    expect(finish).toHaveBeenCalledTimes(1);
  });

  it('dispose detaches session transitions', async () => {
    const pause = vi.spyOn(rt.store, 'pauseAuth');
    rt.dispose();
    useAuthStore.setState({ user: null, token: null, isAuthenticated: false });
    await settle();
    expect(pause).not.toHaveBeenCalled();
  });
});
