import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createNodeSqlDb } from '../sql/node-sqldb.test-helper';
import { migrate } from '../sql/migrations';
import type { SqlDb } from '../sql/types';
import { createOutboxStore, type OutboxStore } from './store';
import type { NewOp } from './op-types';
import { ID_A, ID_B } from './fixtures.test-helper';

// WR-03: finish/cook barriers must also wait on failed, blocked and paused earlier ops.
const U = 'u1';
const check = (id: string): NewOp =>
  ({ kind: 'shopping.item.update', label: 'Milk', payload: { id, patch: { isChecked: true } }, inverse: { previous: {} } }) as NewOp;
const finish: NewOp = {
  kind: 'shopping.finish',
  label: 'Trip',
  payload: { input: { occurredAt: '2026-01-01T00:00:00.000Z', receiptDate: '2026-01-01' } },
};
const adj = (delta: number): NewOp => ({ kind: 'pantry.adjust', label: 'Rice', payload: { id: ID_B, delta } });
const cook: NewOp = {
  kind: 'cook.apply',
  label: 'Cook',
  payload: { target: { recipeId: ID_A }, servings: 1, occurredAt: '2026-01-01T00:00:00.000Z' },
};

let db: SqlDb & { close(): void };
let store: OutboxStore;

beforeEach(async () => {
  db = createNodeSqlDb();
  await migrate(db);
  store = createOutboxStore({ db, now: () => 1000 });
});
afterEach(() => db.close());

describe('barriers over parked ops', () => {
  it('shopping.finish waits while an earlier check-off is failed, and runs once it is discarded', async () => {
    const a = await store.enqueue(U, check(ID_A));
    await store.enqueue(U, finish);
    await store.park(a!.seq, { reason: 'conflict', status: 409 });
    expect(await store.nextReady(U, 5000)).toBeNull();
    await store.discard(a!.seq);
    expect((await store.nextReady(U, 5000))?.kind).toBe('shopping.finish');
  });

  it('cook.apply waits while an earlier pantry op is paused for auth', async () => {
    await store.enqueue(U, adj(1));
    await store.pauseAuth(U);
    await store.enqueue(U, cook);
    expect(await store.nextReady(U, 5000)).toBeNull();
  });
});
