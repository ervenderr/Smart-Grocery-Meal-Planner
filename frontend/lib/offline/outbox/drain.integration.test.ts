import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migrate } from '../sql/migrations';
import { createNodeSqlDb } from '../sql/node-sqldb.test-helper';
import { createFlakyServer, type FlakyServer } from '../test-helpers/flaky-server';
import { createDrainWorker, type DrainWorker } from './drain';
import { createExecutorRegistry } from './executors';
import { createOutboxStore } from './store';
import type { NewOp } from './op-types';
import { ID_A, ID_B } from './fixtures.test-helper';

const U = 'user-1';
const adj = (delta: number): NewOp => ({ kind: 'pantry.adjust', label: 'Rice', payload: { id: ID_A, delta } });
const shopItem = { id: ID_B, itemName: 'Milk', quantity: 1 };

let dir: string;
let server: FlakyServer;
let clock: number;
const open: Array<{ close(): void }> = [];
const workers: DrainWorker[] = [];

async function build(file: string) {
  const db = createNodeSqlDb(file);
  open.push(db);
  await migrate(db);
  const store = createOutboxStore({ db, now: () => clock });
  const worker = createDrainWorker({
    store,
    transport: server.transport,
    executors: createExecutorRegistry(),
    connectivity: { isReachable: async () => true, reportNetworkFailure: () => undefined },
    getUserId: () => U,
    now: () => clock,
    setTimer: () => 0,
    clearTimer: () => undefined,
  });
  workers.push(worker);
  return { db, store, worker };
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'outbox-int-'));
  server = createFlakyServer();
  server.state.pantry.set(ID_A, { quantity: 10 });
  clock = 1000;
});
afterEach(() => {
  workers.splice(0).forEach((w) => w.dispose());
  open.splice(0).forEach((d) => {
    try {
      d.close();
    } catch {
      // already closed by the simulated kill
    }
  });
  rmSync(dir, { recursive: true, force: true });
});

describe('drain integration (flaky server)', () => {
  it('applies every op exactly once under drop-after-commit, timeout and 503', async () => {
    const { store, worker } = await build(join(dir, 'a.db'));
    await store.enqueue(U, adj(2));
    await store.enqueue(U, adj(3));
    await store.enqueue(U, { kind: 'shopping.item.create', label: 'Milk', payload: { item: shopItem } });
    await store.enqueue(U, { kind: 'shopping.item.update', label: 'Milk', payload: { id: ID_B, patch: { isChecked: true } } });
    const keys = (await store.list(U)).map((o) => o.idempotencyKey);
    server.script('drop-after-commit');
    server.script('timeout');
    server.script({ status: 503 });

    for (let i = 0; i < 20 && (await store.list(U)).length > 0; i++) {
      worker.kick('test');
      await worker.whenIdle();
      clock += 60_000;
    }

    expect(await store.list(U)).toHaveLength(0);
    expect(server.state.pantry.get(ID_A)?.quantity).toBe(10 + 5);
    keys.forEach((k) => expect(server.applyCount(k)).toBe(1));
    expect(server.state.shopping.size).toBe(1);
    expect(server.state.shopping.get(ID_B)).toMatchObject({ itemName: 'Milk' });
  });

  it('a worker rebuilt over the same file after a kill finishes in_flight ops exactly once', async () => {
    const file = join(dir, 'kill.db');
    const first = await build(file);
    const op = await first.store.enqueue(U, adj(4));
    await first.store.markInFlight(op!.seq);
    // server committed before the app was killed
    await server.transport.send({ method: 'POST', url: `/api/v1/pantry/${ID_A}/adjust`, body: { delta: 4 }, idempotencyKey: op!.idempotencyKey });
    first.worker.dispose();
    first.db.close();

    const second = await build(file);
    expect(await second.store.resetInFlight()).toBe(1);
    second.worker.kick('boot');
    await second.worker.whenIdle();

    expect(await second.store.list(U)).toHaveLength(0);
    expect(server.applyCount(op!.idempotencyKey)).toBe(1);
    expect(server.state.pantry.get(ID_A)?.quantity).toBe(14);
  });

  it('replaying the same key returns the stored response and never re-applies', async () => {
    const { store, worker } = await build(join(dir, 'r.db'));
    const op = await store.enqueue(U, adj(1));
    worker.kick('x');
    await worker.whenIdle();
    const replay = await server.transport.send({ method: 'POST', url: `/api/v1/pantry/${ID_A}/adjust`, body: { delta: 1 }, idempotencyKey: op!.idempotencyKey });
    expect(replay).toMatchObject({ quantity: 11 });
    expect(server.applyCount(op!.idempotencyKey)).toBe(1);
    expect(server.state.pantry.get(ID_A)?.quantity).toBe(11);
    await expect(
      server.transport.send({ method: 'POST', url: `/api/v1/pantry/${ID_A}/adjust`, body: { delta: 9 }, idempotencyKey: op!.idempotencyKey })
    ).rejects.toMatchObject({ status: 422, code: 'IDEMPOTENCY_KEY_REUSED' });
  });
});
