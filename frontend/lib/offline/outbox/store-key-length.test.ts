import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createNodeSqlDb } from '../sql/node-sqldb.test-helper';
import { migrate } from '../sql/migrations';
import type { SqlDb } from '../sql/types';
import { createOutboxStore, type OutboxStore } from './store';
import { ID_A } from './fixtures.test-helper';

// IN-07: derived keys (`${key}.preview`, +8 chars) must stay within the server's 255-char limit.
let db: SqlDb & { close(): void };
let store: OutboxStore;
const cook = {
  kind: 'cook.apply',
  label: 'Cook',
  payload: { target: { recipeId: ID_A }, servings: 1, occurredAt: '2026-01-01T00:00:00.000Z' },
} as const;

beforeEach(async () => {
  db = createNodeSqlDb();
  await migrate(db);
  store = createOutboxStore({ db, now: () => 1000 });
});
afterEach(() => db.close());

describe('caller idempotency key length', () => {
  it('accepts 200 characters and rejects anything longer', async () => {
    await expect(store.enqueue('u1', cook, { idempotencyKey: 'k'.repeat(200) })).resolves.not.toBeNull();
    await expect(store.enqueue('u1', cook, { idempotencyKey: 'k'.repeat(201) })).rejects.toThrow('Invalid idempotency key');
  });
});
