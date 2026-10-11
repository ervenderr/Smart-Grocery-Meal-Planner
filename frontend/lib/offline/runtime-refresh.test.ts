import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { createNodeSqlDb } from './sql/node-sqldb.test-helper';
import { migrate } from './sql/migrations';
import type { SqlDb } from './sql/types';
import { createOfflineRuntime, setOfflineRuntime, type OfflineRuntime } from './runtime';
import { PANTRY_ALL_KEY } from './cache/cache-keys';
import { ID_A } from './outbox/fixtures.test-helper';

// WR-04: a bootstrap refresh must not apply a snapshot for a user who left, nor one that
// predates ops the drain completed while it was being fetched.
let db: SqlDb & { close(): void };
let qc: QueryClient;
let rt: OfflineRuntime;
let userId: string | null;
const post = vi.fn();

const snapshot = (quantity: number) => ({
  serverTime: '2026-02-02T00:00:00Z',
  section: 'pantry',
  items: [{ id: ID_A, quantity }],
  nextCursor: null,
});

function make(fetchPage: (c: string | null) => Promise<unknown>) {
  rt = createOfflineRuntime({
    db,
    queryClient: qc,
    getUserId: () => userId,
    transportClient: { post, patch: vi.fn(), delete: vi.fn() } as never,
    probe: async () => true,
    fetchPage,
  });
  return rt;
}

beforeEach(async () => {
  db = createNodeSqlDb();
  await migrate(db);
  qc = new QueryClient();
  userId = 'u1';
  post.mockReset();
});
afterEach(() => {
  rt?.dispose();
  setOfflineRuntime(null);
  qc.clear();
  db.close();
});

describe('refreshFromServer races', () => {
  it('drops the snapshot when the user changed during the fetch', async () => {
    make(async () => {
      userId = 'u2';
      return snapshot(5);
    });
    expect(await rt.refreshFromServer('t')).toBe('skipped');
    expect(qc.getQueryData(PANTRY_ALL_KEY)).toBeUndefined();
  });

  it('refetches when the drain completed an op during the fetch', async () => {
    post.mockReturnValue(new Promise(() => {})); // op stays in flight
    let calls = 0;
    const fetchPage = vi.fn(async () => {
      calls += 1;
      if (calls === 1) {
        const [op] = await rt.store.list('u1');
        await rt.store.complete(op.seq); // server applied it after this snapshot was read
        return snapshot(5);
      }
      return snapshot(7);
    });
    make(fetchPage);
    await rt.enqueue({ kind: 'pantry.adjust', label: 'Rice', payload: { id: ID_A, delta: 2 } });
    expect(await rt.refreshFromServer('t')).toBe('ok');
    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect((qc.getQueryData(PANTRY_ALL_KEY) as { quantity: number }[])[0].quantity).toBe(7);
  });
});

describe('persist gate (WR-05)', () => {
  it('does not persist canonical data while a mutation is mid-flight (optimistic state not yet in the outbox)', async () => {
    make(async () => snapshot(1));
    rt.persister.start();
    const mutation = qc.getMutationCache().build(qc, { mutationFn: () => new Promise(() => {}) });
    void mutation.execute(undefined);
    qc.setQueryData(PANTRY_ALL_KEY, [{ id: ID_A, quantity: 9 }]);
    await rt.persister.flush();
    const rows = await db.query<{ n: number }>('SELECT COUNT(*) AS n FROM cache_entries');
    expect(rows[0].n).toBe(0);
  });
});
