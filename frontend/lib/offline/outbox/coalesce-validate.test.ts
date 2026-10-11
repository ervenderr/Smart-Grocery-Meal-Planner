import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createNodeSqlDb } from '../sql/node-sqldb.test-helper';
import { migrate } from '../sql/migrations';
import type { SqlDb } from '../sql/types';
import { planEnqueue } from './coalesce';
import { createOutboxStore, type OutboxStore } from './store';
import type { NewOp } from './op-types';
import { ID_A, makeOp } from './fixtures.test-helper';

// CR-02: merging a pantry.update with null fields into a pending pantry.create must keep the row valid and visible.
const U = 'u1';
const create: NewOp = {
  kind: 'pantry.create',
  label: 'Rice',
  payload: {
    item: {
      id: ID_A,
      ingredientName: 'Rice',
      category: 'grains',
      quantity: 1,
      unit: 'kg',
      expiryDate: '2026-12-01',
      barcode: '123',
    },
  },
};
const clear = (patch: Record<string, unknown>): NewOp =>
  ({
    kind: 'pantry.update',
    label: 'Rice',
    payload: { id: ID_A, patch },
    inverse: { previous: {} },
  }) as NewOp;
const adj = (delta: number): NewOp => ({
  kind: 'pantry.adjust',
  label: 'Rice',
  payload: { id: ID_A, delta },
});

let db: SqlDb & { close(): void };
let store: OutboxStore;

beforeEach(async () => {
  db = createNodeSqlDb();
  await migrate(db);
  store = createOutboxStore({ db, now: () => 1000 });
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  db.close();
});

describe('planUpdate into a pending create', () => {
  it('drops fields cleared with null instead of writing null into the create', () => {
    const plan = planEnqueue(
      [makeOp(create)],
      clear({ expiryDate: null, barcode: null, notes: 'n' })
    );
    expect(plan).toMatchObject({ type: 'merge' });
    const item = (plan as { payload: { item: Record<string, unknown> } }).payload.item;
    expect(item).not.toHaveProperty('expiryDate');
    expect(item).not.toHaveProperty('barcode');
    expect(item).toMatchObject({ ingredientName: 'Rice', notes: 'n' });
  });
});

describe('store merge validation', () => {
  it('keeps the created item visible and sendable after a clearing update', async () => {
    await store.enqueue(U, create);
    await store.enqueue(U, clear({ expiryDate: null }));
    const rows = await store.list(U);
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe('pantry.create');
    expect((rows[0].payload as { item: object }).item).not.toHaveProperty('expiryDate');
    expect((await store.nextReady(U, 2000))?.seq).toBe(rows[0].seq);
  });
});

describe('invalid stored rows', () => {
  it('are surfaced as failed/invalid, park dependents, and can be discarded', async () => {
    const bad = await store.enqueue(U, create);
    await db.run('UPDATE outbox SET payload_json = ? WHERE seq = ?', [
      JSON.stringify({ item: { id: ID_A, expiryDate: null } }),
      bad!.seq,
    ]);
    await store.enqueue(U, adj(1));

    expect(await store.nextReady(U, 2000)).toBeNull();
    const rows = await store.list(U);
    expect(rows.map((r) => [r.seq, r.state, r.lastError?.reason ?? null])).toEqual([
      [bad!.seq, 'failed', 'invalid'],
      [bad!.seq + 1, 'blocked', null],
    ]);
    expect((await store.counts(U)).failed).toBe(1);
    expect(await store.discard(bad!.seq)).toHaveLength(2);
    expect(await store.list(U)).toHaveLength(0);
  });
});
