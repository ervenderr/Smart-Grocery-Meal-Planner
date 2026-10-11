import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createNodeSqlDb } from '../sql/node-sqldb.test-helper';
import { migrate } from '../sql/migrations';
import type { SqlDb } from '../sql/types';
import type { Transport, TransportRequest } from '../transport';
import { createDrainWorker, type DrainEvent, type DrainWorker } from './drain';
import { createExecutorRegistry } from './executors';
import { createOutboxStore, type OutboxStore } from './store';
import type { NewOp } from './op-types';
import type { TransportFailure } from './classify-error';
import { ID_A, ID_B } from './fixtures.test-helper';

const U = 'u1';
const fail = (f: Partial<TransportFailure>): TransportFailure => ({ network: false, timeout: false, ...f });
const adj = (id: string, delta: number): NewOp => ({ kind: 'pantry.adjust', label: 'Rice', payload: { id, delta } });
const del = (id: string): NewOp => ({ kind: 'pantry.delete', label: 'Rice', payload: { id } });
const shopDel = (id: string): NewOp => ({ kind: 'shopping.item.delete', label: 'Milk', payload: { id } });

let db: SqlDb & { close(): void };
let store: OutboxStore;
let clock: number;
let reachable: boolean;
let responder: (req: TransportRequest) => unknown;
let sent: TransportRequest[];
let events: DrainEvent[];
let user: string | null;
let timers: Array<{ fn: () => void; ms: number }>;
let netFailures: number;
let worker: DrainWorker;

beforeEach(async () => {
  db = createNodeSqlDb();
  await migrate(db);
  clock = 1000;
  reachable = true;
  user = U;
  sent = [];
  events = [];
  timers = [];
  netFailures = 0;
  responder = () => ({ ok: true });
  store = createOutboxStore({ db, now: () => clock });
  const transport: Transport = {
    async send<T>(req: TransportRequest) {
      sent.push(req);
      const r = responder(req);
      if (r instanceof Error) throw r;
      if (typeof r === 'object' && r !== null && 'network' in r && 'timeout' in r) throw r;
      return r as T;
    },
  };
  worker = createDrainWorker({
    store,
    transport,
    executors: createExecutorRegistry(),
    connectivity: { isReachable: async () => reachable, reportNetworkFailure: () => void (netFailures += 1) },
    getUserId: () => user,
    now: () => clock,
    setTimer: (fn, ms) => {
      timers.push({ fn, ms });
      return timers.length;
    },
    clearTimer: vi.fn(),
    onEvent: (e) => events.push(e),
  });
});
afterEach(() => {
  worker.dispose();
  db.close();
});

const drain = async () => {
  worker.kick('test');
  await worker.whenIdle();
};
const types = () => events.map((e) => e.type);

describe('drain worker', () => {
  it('sends ops in seq order and reports finished counts', async () => {
    await store.enqueue(U, adj(ID_A, 1));
    await store.enqueue(U, adj(ID_B, 2));
    await store.enqueue(U, shopDel(ID_A));
    await drain();
    expect(sent.map((r) => r.url)).toEqual([`/api/v1/pantry/${ID_A}/adjust`, `/api/v1/pantry/${ID_B}/adjust`, `/api/v1/shopping/items/${ID_A}`]);
    expect(events.at(-1)).toEqual({ type: 'finished', applied: 3, parked: 0 });
    expect((await store.list(U)).length).toBe(0);
  });

  it('does nothing without a user', async () => {
    await store.enqueue(U, adj(ID_A, 1));
    user = null;
    await drain();
    expect(sent).toHaveLength(0);
    expect(events).toHaveLength(0);
  });

  it('emits offline and sends nothing when unreachable', async () => {
    await store.enqueue(U, adj(ID_A, 1));
    reachable = false;
    await drain();
    expect(sent).toHaveLength(0);
    expect(types()).toContain('offline');
    expect((await store.counts(U)).queued).toBe(1);
  });

  it('a kick during a run triggers exactly one rerun', async () => {
    await store.enqueue(U, adj(ID_A, 1));
    worker.kick('a');
    expect(worker.isDraining()).toBe(true);
    worker.kick('b');
    worker.kick('c');
    await worker.whenIdle();
    expect(types().filter((t) => t === 'started')).toHaveLength(2);
    expect(worker.isDraining()).toBe(false);
  });

  it('network failure stops the loop without counting an attempt', async () => {
    await store.enqueue(U, adj(ID_A, 1));
    await store.enqueue(U, adj(ID_B, 2));
    responder = () => fail({ network: true });
    await drain();
    expect(sent).toHaveLength(1);
    expect(netFailures).toBe(1);
    const [first] = await store.list(U);
    expect(first.attempts).toBe(0);
    expect(first.state).toBe('queued');
    expect(types()).toContain('offline');
  });

  it('503 schedules a counted retry and arms a backoff timer', async () => {
    await store.enqueue(U, adj(ID_A, 1));
    responder = () => fail({ status: 503 });
    await drain();
    const [op] = await store.list(U);
    expect(op.attempts).toBe(1);
    expect(op.nextAttemptAt).toBeGreaterThan(clock);
    expect(types()).toContain('retry-scheduled');
    expect(timers).toHaveLength(1);
    expect(timers[0].ms).toBe(op.nextAttemptAt - clock);
    responder = () => ({ ok: true });
    clock = op.nextAttemptAt;
    timers[0].fn();
    await worker.whenIdle();
    expect(await store.list(U)).toHaveLength(0);
  });

  it('401 pauses all rows without deleting any', async () => {
    await store.enqueue(U, adj(ID_A, 1));
    await store.enqueue(U, adj(ID_B, 2));
    responder = () => fail({ status: 401 });
    await drain();
    const rows = await store.list(U);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.state === 'paused_auth')).toBe(true);
    expect(types()).toContain('auth-paused');
    expect(sent).toHaveLength(1);
  });

  it('404 on delete completes the op', async () => {
    await store.enqueue(U, del(ID_A));
    responder = () => fail({ status: 404 });
    await drain();
    expect(await store.list(U)).toHaveLength(0);
    expect(events.at(-1)).toEqual({ type: 'finished', applied: 1, parked: 0 });
  });

  it('404 on adjust parks gone, other entities still drain, same entity stays blocked', async () => {
    await store.enqueue(U, adj(ID_A, 1));
    await store.enqueue(U, adj(ID_B, 2));
    await store.enqueue(U, { kind: 'pantry.update', label: 'Rice', payload: { id: ID_A, patch: { notes: 'x' } } });
    responder = (req) => (req.url.includes(ID_A) && req.method === 'POST' ? fail({ status: 404 }) : { ok: true });
    await drain();
    const rows = await store.list(U);
    expect(rows.map((r) => [r.entityId, r.state])).toEqual([[ID_A, 'failed'], [ID_A, 'blocked']]);
    expect(rows[0].lastError?.reason).toBe('gone');
    expect(events.at(-1)).toEqual({ type: 'finished', applied: 1, parked: 1 });
    expect(types()).toContain('parked');
  });

  it('parks ops with no executor as invalid', async () => {
    await store.enqueue(U, { kind: 'cook.apply', label: 'Cook', payload: { target: { recipeId: ID_A }, servings: 2, occurredAt: '2026-01-01T00:00:00.000Z' } });
    await drain();
    const [op] = await store.list(U);
    expect(op.state).toBe('failed');
    expect(op.lastError?.reason).toBe('invalid');
    expect(sent).toHaveLength(0);
  });

  it('treats a non-failure throw as transient', async () => {
    await store.enqueue(U, adj(ID_A, 1));
    responder = () => new Error('boom');
    await drain();
    const [op] = await store.list(U);
    expect(op.attempts).toBe(1);
  });

  it('parks after max transient attempts', async () => {
    await store.enqueue(U, adj(ID_A, 1));
    responder = () => fail({ status: 500 });
    for (let i = 0; i < 8; i++) {
      clock += 60_000;
      await drain();
    }
    const [op] = await store.list(U);
    expect(op.state).toBe('failed');
    expect(op.lastError?.reason).toBe('max-attempts');
  });

  it('dispose stops further kicks and clears the timer', async () => {
    await store.enqueue(U, adj(ID_A, 1));
    responder = () => fail({ status: 503 });
    await drain();
    worker.dispose();
    worker.kick('after');
    await worker.whenIdle();
    expect(sent).toHaveLength(1);
  });

  it('survives a store failure without throwing', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(store, 'nextReady').mockRejectedValue(new Error('db'));
    await drain();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
