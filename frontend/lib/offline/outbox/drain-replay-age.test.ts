import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createNodeSqlDb } from '../sql/node-sqldb.test-helper';
import { migrate } from '../sql/migrations';
import type { SqlDb } from '../sql/types';
import type { Transport, TransportRequest } from '../transport';
import { createDrainWorker, SAFE_REPLAY_MS } from './drain';
import { createExecutorRegistry } from './executors';
import { createOutboxStore, type OutboxStore } from './store';
import { isInDoubt } from './fold';
import type { TransportFailure } from './classify-error';
import { reasonCopy } from '../status/describe-op';
import { ID_A } from './fixtures.test-helper';

// WR-09: an in-doubt op must not be replayed after the server idempotency record may have expired.
const U = 'u1';
let db: SqlDb & { close(): void };
let store: OutboxStore;
let clock: number;
let sent: TransportRequest[];
let respond: () => unknown;

const worker = () =>
  createDrainWorker({
    store,
    transport: {
      async send<T>(req: TransportRequest) {
        sent.push(req);
        const r = respond();
        if (typeof r === 'object' && r !== null && 'timeout' in r) throw r;
        return r as T;
      },
    } as Transport,
    executors: createExecutorRegistry(),
    connectivity: { isReachable: async () => true, reportNetworkFailure: () => undefined },
    getUserId: () => U,
    now: () => clock,
    setTimer: () => 0,
    clearTimer: () => undefined,
  });

const drain = async () => {
  const w = worker();
  w.kick('t');
  await w.whenIdle();
  w.dispose();
};
const timeout: TransportFailure = { network: false, timeout: true };
const offline: TransportFailure = { network: true, timeout: false };

beforeEach(async () => {
  db = createNodeSqlDb();
  await migrate(db);
  clock = 1_000_000;
  sent = [];
  store = createOutboxStore({ db, now: () => clock });
});
afterEach(() => db.close());

describe('in-doubt replay age guard', () => {
  it('keeps the in-doubt marker and its start time across later inconclusive failures', async () => {
    await store.enqueue(U, { kind: 'pantry.adjust', label: 'Rice', payload: { id: ID_A, delta: 2 } });
    respond = () => timeout;
    await drain();
    const start = clock;
    clock += 60_000;
    respond = () => offline;
    await drain();
    const [row] = await store.list(U);
    expect(isInDoubt(row)).toBe(true);
    expect(row.lastError).toMatchObject({ code: 'IN_DOUBT', since: start });
  });

  it('parks an in-doubt op instead of replaying it once the idempotency window may have expired', async () => {
    await store.enqueue(U, { kind: 'pantry.adjust', label: 'Rice', payload: { id: ID_A, delta: 2 } });
    respond = () => timeout;
    await drain();
    expect(sent).toHaveLength(1);
    clock += SAFE_REPLAY_MS + 1;
    respond = () => ({ id: ID_A, quantity: 9 });
    await drain();
    expect(sent).toHaveLength(1);
    const [row] = await store.list(U);
    expect(row).toMatchObject({ state: 'failed', lastError: { reason: 'conflict', code: 'REPLAY_EXPIRED' } });
    expect(reasonCopy(row)).toMatch(/may already be saved/);
  });

  it('a user retry after expiry sends it once more (explicit choice)', async () => {
    await store.enqueue(U, { kind: 'pantry.adjust', label: 'Rice', payload: { id: ID_A, delta: 2 } });
    respond = () => timeout;
    await drain();
    clock += SAFE_REPLAY_MS + 1;
    await drain();
    const [row] = await store.list(U);
    await store.retry(row.seq);
    respond = () => ({ id: ID_A, quantity: 9 });
    await drain();
    expect(sent).toHaveLength(2);
    expect(await store.list(U)).toHaveLength(0);
  });
});
