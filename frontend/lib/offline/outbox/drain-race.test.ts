import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createNodeSqlDb } from '../sql/node-sqldb.test-helper';
import { migrate } from '../sql/migrations';
import type { SqlDb } from '../sql/types';
import type { Transport, TransportRequest } from '../transport';
import { createDrainWorker } from './drain';
import { createExecutorRegistry } from './executors';
import { createOutboxStore, type OutboxStore } from './store';
import type { NewOp } from './op-types';
import { ID_A } from './fixtures.test-helper';

// CR-01: an enqueue that lands between nextReady and the in-flight claim must not be lost or resurrected.
const U = 'u1';
const adj = (delta: number): NewOp => ({ kind: 'pantry.adjust', label: 'Rice', payload: { id: ID_A, delta } });

let db: SqlDb & { close(): void };
let store: OutboxStore;
let sent: TransportRequest[];

beforeEach(async () => {
  db = createNodeSqlDb();
  await migrate(db);
  store = createOutboxStore({ db, now: () => 1000 });
  sent = [];
});
afterEach(() => db.close());

function workerRacing(raceOp: NewOp) {
  let raced = false;
  const racingStore: OutboxStore = {
    ...store,
    async nextReady(userId, at) {
      const op = await store.nextReady(userId, at);
      if (op && !raced) {
        raced = true;
        await store.enqueue(U, raceOp);
      }
      return op;
    },
  };
  const transport: Transport = {
    async send<T>(req: TransportRequest) {
      sent.push(req);
      return { ok: true } as T;
    },
  };
  return createDrainWorker({
    store: racingStore,
    transport,
    executors: createExecutorRegistry(),
    connectivity: { isReachable: async () => true, reportNetworkFailure: () => undefined },
    getUserId: () => U,
    now: () => 1000,
    setTimer: () => 0,
    clearTimer: () => undefined,
  });
}

describe('drain claim race (CR-01)', () => {
  it('sends the merged payload when an enqueue merges into the op after it was read', async () => {
    await store.enqueue(U, adj(2));
    const worker = workerRacing(adj(3));
    worker.kick('t');
    await worker.whenIdle();
    expect(sent.map((r) => r.body)).toEqual([{ delta: 5 }]);
    expect(await store.list(U)).toHaveLength(0);
  });

  it('sends nothing when an enqueue cancels the op after it was read', async () => {
    await store.enqueue(U, adj(1));
    const worker = workerRacing(adj(-1));
    worker.kick('t');
    await worker.whenIdle();
    expect(sent).toEqual([]);
    expect(await store.list(U)).toHaveLength(0);
  });
});

describe('store.claim', () => {
  it('returns the fresh row and marks it in flight', async () => {
    const op = await store.enqueue(U, adj(2));
    await store.enqueue(U, adj(3));
    const claimed = await store.claim(op!.seq);
    expect(claimed).toMatchObject({ seq: op!.seq, state: 'in_flight', payload: { id: ID_A, delta: 5 } });
    expect((await store.list(U))[0].state).toBe('in_flight');
  });

  it('returns null for a removed or non-queued row', async () => {
    const op = await store.enqueue(U, adj(2));
    await store.enqueue(U, adj(-2));
    expect(await store.claim(op!.seq)).toBeNull();
    const again = await store.enqueue(U, adj(1));
    await store.markInFlight(again!.seq);
    expect(await store.claim(again!.seq)).toBeNull();
  });
});
