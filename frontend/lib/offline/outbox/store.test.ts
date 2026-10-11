import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createNodeSqlDb } from '../sql/node-sqldb.test-helper';
import { migrate } from '../sql/migrations';
import type { SqlDb } from '../sql/types';
import { createOutboxStore, type OutboxStore } from './store';
import type { NewOp } from './op-types';
import { ID_A, ID_B } from './fixtures.test-helper';

const U = 'user-1';
const upd = (id: string, patch: Record<string, unknown>): NewOp =>
  ({ kind: 'shopping.item.update', label: 'Milk', payload: { id, patch }, inverse: { previous: {} } }) as NewOp;
const adj = (id: string, delta: number): NewOp => ({ kind: 'pantry.adjust', label: 'Rice', payload: { id, delta } });
const del = (id: string): NewOp => ({ kind: 'shopping.item.delete', label: 'Milk', payload: { id } });
const finish: NewOp = { kind: 'shopping.finish', label: 'Trip', payload: { input: { occurredAt: '2026-01-01T00:00:00.000Z', receiptDate: '2026-01-01' } } };

let db: SqlDb & { close(): void };
let store: OutboxStore;
let clock = 1000;

async function setup(path = ':memory:') {
  db = createNodeSqlDb(path);
  await migrate(db);
  store = createOutboxStore({ db, now: () => clock });
}

beforeEach(async () => {
  clock = 1000;
  await setup();
});
afterEach(() => db.close());

describe('enqueue', () => {
  it('persists all fields', async () => {
    const op = await store.enqueue(U, upd(ID_A, { quantity: 2 }));
    expect(op).toMatchObject({
      userId: U, kind: 'shopping.item.update', entityType: 'shopping-item', entityId: ID_A,
      label: 'Milk', state: 'queued', attempts: 0, lastError: null, nextAttemptAt: 0, createdAt: 1000, resolved: null,
      payload: { id: ID_A, patch: { quantity: 2 } },
    });
    expect(op?.opId).toMatch(/^[0-9a-f-]{36}$/);
    expect(op?.idempotencyKey).toMatch(/^[A-Za-z0-9._:-]{8,255}$/);
  });
  it('stores opts verbatim and never merges into them', async () => {
    const first = await store.enqueue(U, upd(ID_A, { quantity: 2 }), { idempotencyKey: 'fixed-key-123', resolved: { body: 1 } });
    expect(first).toMatchObject({ idempotencyKey: 'fixed-key-123', resolved: { body: 1 } });
    const second = await store.enqueue(U, upd(ID_A, { quantity: 3 }));
    expect(second?.seq).not.toBe(first?.seq);
    const third = await store.enqueue(U, upd(ID_A, { notes: 'x' }), { idempotencyKey: 'fixed-key-456' });
    expect(third?.seq).not.toBe(second?.seq);
    expect(await store.list(U)).toHaveLength(3);
  });
  it('rejects bad idempotency key', async () => {
    await expect(store.enqueue(U, upd(ID_A, { quantity: 2 }), { idempotencyKey: 'bad key!' })).rejects.toThrow();
  });
  it('coalesces un-attempted updates', async () => {
    await store.enqueue(U, upd(ID_A, { quantity: 2 }));
    await store.enqueue(U, upd(ID_A, { notes: 'n' }));
    const rows = await store.list(U);
    expect(rows).toHaveLength(1);
    expect(rows[0].payload).toEqual({ id: ID_A, patch: { quantity: 2, notes: 'n' } });
  });
  it('drop plan returns null and removes rows', async () => {
    await store.enqueue(U, adj(ID_A, 2));
    expect(await store.enqueue(U, adj(ID_A, -2))).toBeNull();
    expect(await store.list(U)).toHaveLength(0);
  });
  it('rejects invalid op without writing', async () => {
    await expect(store.enqueue(U, { kind: 'pantry.adjust', label: 'x', payload: { id: ID_A, delta: 0 } })).rejects.toThrow();
    expect(await store.list(U)).toHaveLength(0);
  });
  it('keeps seq order across entities and filters by user', async () => {
    await store.enqueue(U, upd(ID_A, { quantity: 2 }));
    await store.enqueue(U, adj(ID_B, 1));
    await store.enqueue('other', adj(ID_B, 1));
    expect((await store.list(U)).map((o) => o.entityId)).toEqual([ID_A, ID_B]);
    expect(await store.list('other')).toHaveLength(1);
  });
});

describe('nextReady / state machine', () => {
  it('skips entity with earlier failed op but returns other entity', async () => {
    const a = await store.enqueue(U, upd(ID_A, { quantity: 2 }));
    await store.markInFlight(a!.seq);
    await store.park(a!.seq, { reason: 'invalid', status: 400 });
    await store.enqueue(U, upd(ID_A, { notes: 'later' }));
    await store.enqueue(U, adj(ID_B, 1));
    const next = await store.nextReady(U, 5000);
    expect(next?.entityId).toBe(ID_B);
  });
  it('respects next_attempt_at and user', async () => {
    const a = await store.enqueue(U, adj(ID_A, 1));
    await store.scheduleRetry(a!.seq, { reason: 'transient' }, 9000, true);
    expect(await store.nextReady(U, 8000)).toBeNull();
    expect((await store.nextReady(U, 9000))?.seq).toBe(a!.seq);
    expect(await store.nextReady('other', 9000)).toBeNull();
  });
  it('scheduleRetry counts attempts only when asked', async () => {
    const a = await store.enqueue(U, adj(ID_A, 1));
    await store.scheduleRetry(a!.seq, { reason: 'transient' }, 0, false);
    expect((await store.list(U))[0].attempts).toBe(0);
    await store.scheduleRetry(a!.seq, { reason: 'transient' }, 0, true);
    expect((await store.list(U))[0]).toMatchObject({ attempts: 1, state: 'queued', lastError: { reason: 'transient' } });
  });
  it('a retried op is never coalesced into', async () => {
    const a = await store.enqueue(U, adj(ID_A, 1));
    await store.scheduleRetry(a!.seq, { reason: 'transient' }, 0, false);
    await store.enqueue(U, adj(ID_A, 2));
    expect(await store.list(U)).toHaveLength(2);
  });
  it('finish is not ready while earlier shopping-item op is queued', async () => {
    const a = await store.enqueue(U, upd(ID_A, { quantity: 2 }));
    await store.enqueue(U, finish);
    expect((await store.nextReady(U, 5000))?.seq).toBe(a!.seq);
    await store.markInFlight(a!.seq);
    expect(await store.nextReady(U, 5000)).toBeNull();
    await store.complete(a!.seq);
    expect((await store.nextReady(U, 5000))?.kind).toBe('shopping.finish');
  });
  it('park blocks dependents and retry unblocks', async () => {
    const a = await store.enqueue(U, upd(ID_A, { quantity: 2 }));
    await store.markInFlight(a!.seq);
    const b = await store.enqueue(U, upd(ID_A, { notes: 'x' }));
    expect(b?.state).toBe('queued');
    await store.park(a!.seq, { reason: 'conflict', status: 409 });
    expect((await store.list(U)).map((o) => o.state)).toEqual(['failed', 'blocked']);
    expect(await store.counts(U)).toEqual({ queued: 0, inFlight: 0, failed: 1, blocked: 1, pausedAuth: 0 });
    await store.retry(a!.seq);
    expect((await store.list(U)).map((o) => o.state)).toEqual(['queued', 'queued']);
    expect((await store.list(U))[0].attempts).toBe(0);
  });
  it('new ops after a failed op are enqueued blocked', async () => {
    const a = await store.enqueue(U, adj(ID_A, 1));
    await store.park(a!.seq, { reason: 'gone', status: 404 });
    const b = await store.enqueue(U, adj(ID_A, 1));
    expect(b?.state).toBe('blocked');
  });
  it('discard returns op and blocked dependents', async () => {
    const a = await store.enqueue(U, adj(ID_A, 1));
    await store.park(a!.seq, { reason: 'gone' });
    await store.enqueue(U, adj(ID_A, 2));
    await store.enqueue(U, adj(ID_B, 2));
    const gone = await store.discard(a!.seq);
    expect(gone).toHaveLength(2);
    expect(gone[0].seq).toBe(a!.seq);
    expect(await store.list(U)).toHaveLength(1);
  });
  it('discardAllFailed', async () => {
    const a = await store.enqueue(U, adj(ID_A, 1));
    const b = await store.enqueue(U, adj(ID_B, 1));
    await store.park(a!.seq, { reason: 'gone' });
    await store.park(b!.seq, { reason: 'gone' });
    expect(await store.discardAllFailed(U)).toHaveLength(2);
    expect(await store.list(U)).toHaveLength(0);
  });
  it('resetInFlight moves in_flight to queued and prevents coalescing', async () => {
    const a = await store.enqueue(U, adj(ID_A, 1));
    await store.markInFlight(a!.seq);
    expect(await store.resetInFlight()).toBe(1);
    expect((await store.list(U))[0].state).toBe('queued');
    await store.enqueue(U, adj(ID_A, 2));
    expect(await store.list(U)).toHaveLength(2);
  });
  it('pauseAuth/resumeAuth keeps all rows', async () => {
    const a = await store.enqueue(U, adj(ID_A, 1));
    await store.enqueue(U, adj(ID_B, 1));
    await store.markInFlight(a!.seq);
    await store.pauseAuth(U);
    expect((await store.list(U)).every((o) => o.state === 'paused_auth')).toBe(true);
    expect(await store.nextReady(U, 5000)).toBeNull();
    await store.resumeAuth(U);
    const rows = await store.list(U);
    expect(rows.map((o) => o.state)).toEqual(['queued', 'queued']);
    expect(rows).toHaveLength(2);
  });
  it('saveResolved never overwrites; payload stable after markInFlight', async () => {
    const a = await store.enqueue(U, adj(ID_A, 1));
    await store.saveResolved(a!.seq, { v: 1 });
    await store.saveResolved(a!.seq, { v: 2 });
    await store.markInFlight(a!.seq);
    const [row] = await store.list(U);
    expect(row.resolved).toEqual({ v: 1 });
    expect(row.payload).toEqual(a!.payload);
    expect(row.idempotencyKey).toBe(a!.idempotencyKey);
  });
  it('complete deletes the row', async () => {
    const a = await store.enqueue(U, adj(ID_A, 1));
    await store.complete(a!.seq);
    expect(await store.list(U)).toHaveLength(0);
  });
});

describe('subscribe and robustness', () => {
  it('notifies after enqueue and complete, and unsubscribes', async () => {
    const fn = vi.fn();
    const off = store.subscribe(fn);
    const a = await store.enqueue(U, adj(ID_A, 1));
    expect(fn).toHaveBeenCalledTimes(1);
    await store.complete(a!.seq);
    expect(fn).toHaveBeenCalledTimes(2);
    off();
    await store.enqueue(U, adj(ID_A, 1));
    expect(fn).toHaveBeenCalledTimes(2);
  });
  it('skips invalid rows when listing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await db.run(
      `INSERT INTO outbox (op_id, idempotency_key, user_id, kind, entity_type, entity_id, payload_json, label, state, created_at, updated_at)
       VALUES ('o','k-12345678',?,'pantry.adjust','pantry-item','x','{bad','l','queued',1,1)`, [U]);
    await store.enqueue(U, adj(ID_A, 1));
    expect(await store.list(U)).toHaveLength(1);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('durability', () => {
  it('rebuilt store over same file returns identical rows', async () => {
    db.close();
    const dir = mkdtempSync(join(tmpdir(), 'outbox-'));
    const file = join(dir, 'k.db');
    try {
      await setup(file);
      await store.enqueue(U, upd(ID_A, { quantity: 2 }));
      const a = await store.enqueue(U, adj(ID_B, 3));
      await store.markInFlight(a!.seq);
      const before = await store.list(U);
      db.close();
      await setup(file);
      expect(await store.list(U)).toEqual(before);
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
      await setup();
    }
  });
});

describe('deleteForUser', () => {
  it('removes only that user ops', async () => {
    await store.enqueue(U, adj(ID_A, 1));
    await store.enqueue('user-2', adj(ID_B, 1));
    expect(await store.deleteForUser(U)).toBe(1);
    expect(await store.list(U)).toHaveLength(0);
    expect(await store.list('user-2')).toHaveLength(1);
  });
});
