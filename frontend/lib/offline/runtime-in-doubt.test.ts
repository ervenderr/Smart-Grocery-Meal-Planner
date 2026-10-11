import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { createNodeSqlDb } from './sql/node-sqldb.test-helper';
import { migrate } from './sql/migrations';
import type { SqlDb } from './sql/types';
import { createOfflineRuntime, setOfflineRuntime, type OfflineRuntime } from './runtime';
import { PANTRY_ALL_KEY } from './cache/cache-keys';
import { createOutboxStore } from './outbox/store';
import { isInDoubt } from './outbox/fold';
import { ID_A } from './outbox/fixtures.test-helper';

// WR-07: an op whose request may already have reached the server must not be folded over a
// fresh server snapshot (double count). The refresh resolves it by idempotent replay first.
let db: SqlDb & { close(): void };
let qc: QueryClient;
let rt: OfflineRuntime;
const post = vi.fn();
const adjust = { kind: 'pantry.adjust', label: 'Rice', payload: { id: ID_A, delta: 2 } } as const;
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
    getUserId: () => 'u1',
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
  post.mockReset();
});
afterEach(() => {
  rt?.dispose();
  setOfflineRuntime(null);
  qc.clear();
  db.close();
});

describe('in-doubt ops', () => {
  it('resetInFlight marks rows killed in flight as in doubt', async () => {
    const store = createOutboxStore({ db });
    const op = await store.enqueue('u1', adjust);
    await store.markInFlight(op!.seq);
    await store.resetInFlight();
    const [row] = await store.list('u1');
    expect(row.lastError).toMatchObject({ reason: 'transient', code: 'IN_DOUBT' });
    expect(isInDoubt(row)).toBe(true);
  });

  it('a timed-out send is recorded as in doubt', async () => {
    post.mockRejectedValue({ code: 'ECONNABORTED' });
    make(async () => snapshot(5));
    vi.spyOn(rt.connectivity, 'reportNetworkFailure').mockImplementation(() => undefined);
    await rt.enqueue(adjust);
    await rt.drain.whenIdle();
    const [row] = await rt.store.list('u1');
    expect(row.lastError?.code).toBe('IN_DOUBT');
  });

  it('refresh replays an in-doubt op before applying the snapshot, so it is not folded twice', async () => {
    const store = createOutboxStore({ db });
    const op = await store.enqueue('u1', adjust);
    await store.markInFlight(op!.seq);
    await store.resetInFlight(); // killed while in flight; the server had applied it (5 -> 7)
    post.mockResolvedValue({ id: ID_A, quantity: 7 });
    const fetchPage = vi.fn(async () => snapshot(7));
    make(fetchPage);
    expect(await rt.refreshFromServer('t')).toBe('ok');
    expect(post).toHaveBeenCalledTimes(1);
    expect((qc.getQueryData(PANTRY_ALL_KEY) as { quantity: number }[])[0].quantity).toBe(7);
  });

  it('refresh skips applying while an in-doubt op cannot be resolved yet', async () => {
    const store = createOutboxStore({ db });
    const op = await store.enqueue('u1', adjust);
    await store.markInFlight(op!.seq);
    await store.resetInFlight();
    post.mockRejectedValue({ response: { status: 503 } });
    const fetchPage = vi.fn(async () => snapshot(7));
    make(fetchPage);
    await store.scheduleRetry(op!.seq, { reason: 'transient', code: 'IN_DOUBT' }, Date.now() + 60_000, false);
    expect(await rt.refreshFromServer('t')).toBe('skipped');
    expect(fetchPage).not.toHaveBeenCalled();
    expect(qc.getQueryData(PANTRY_ALL_KEY)).toBeUndefined();
  });
});
