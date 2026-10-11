import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createNodeSqlDb } from '../sql/node-sqldb.test-helper';
import { migrate } from '../sql/migrations';
import type { SqlDb } from '../sql/types';
import { classify, MAX_TRANSIENT_ATTEMPTS } from './classify-error';
import { createOutboxStore, type OutboxStore } from './store';
import { ID_A } from './fixtures.test-helper';

// WR-10: a manual retry of a max-attempts op gets a full new set of attempts.
let db: SqlDb & { close(): void };
let store: OutboxStore;

beforeEach(async () => {
  db = createNodeSqlDb();
  await migrate(db);
  store = createOutboxStore({ db, now: () => 1000 });
});
afterEach(() => db.close());

describe('manual retry', () => {
  it('resets attempts so the next transient failure does not re-park immediately', async () => {
    const op = await store.enqueue('u1', { kind: 'pantry.adjust', label: 'Rice', payload: { id: ID_A, delta: 1 } });
    for (let i = 0; i < MAX_TRANSIENT_ATTEMPTS - 1; i += 1) {
      await store.scheduleRetry(op!.seq, { reason: 'transient', status: 503 }, 0, true);
    }
    await store.park(op!.seq, { reason: 'max-attempts', status: 503 });
    await store.retry(op!.seq);
    const [row] = await store.list('u1');
    expect(row).toMatchObject({ state: 'queued', attempts: 0, nextAttemptAt: 0 });
    expect(classify({ network: false, timeout: false, status: 503 }, { kind: row.kind, attempts: row.attempts }).kind).toBe('retry');
  });
});
