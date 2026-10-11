import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createNodeSqlDb } from '../sql/node-sqldb.test-helper';
import { migrate } from '../sql/migrations';
import type { SqlDb } from '../sql/types';
import { createOutboxStore } from './store';
import { ID_A } from './fixtures.test-helper';

// WR-02: the native plugin may omit changes.lastId; enqueue must still return the inserted row.
let db: SqlDb & { close(): void };

/** Same database, but run() never reports lastInsertRowid (like a plugin without changes.lastId). */
const withoutLastId = (inner: SqlDb): SqlDb => {
  const wrap = (d: SqlDb): SqlDb => ({
    exec: (sql) => d.exec(sql),
    query: (sql, params) => d.query(sql, params),
    run: async (sql, params) => ({ changes: (await d.run(sql, params)).changes }),
    transaction: (fn) => d.transaction((tx) => fn(wrap(tx))),
  });
  return wrap(inner);
};

beforeEach(async () => {
  db = createNodeSqlDb();
  await migrate(db);
});
afterEach(() => db.close());

describe('enqueue without lastInsertRowid', () => {
  it('re-selects the inserted row by op id', async () => {
    const store = createOutboxStore({ db: withoutLastId(db), now: () => 1000 });
    const op = await store.enqueue('u1', { kind: 'pantry.adjust', label: 'Rice', payload: { id: ID_A, delta: 1 } });
    expect(op).toMatchObject({ kind: 'pantry.adjust', payload: { id: ID_A, delta: 1 }, state: 'queued' });
    expect(op?.seq).toBe((await store.list('u1'))[0].seq);
  });
});
