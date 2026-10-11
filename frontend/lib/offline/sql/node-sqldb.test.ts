import { afterEach, describe, expect, it } from 'vitest';
import { createNodeSqlDb } from './node-sqldb.test-helper';

let db = createNodeSqlDb(':memory:');
afterEach(() => db.close());

async function fresh() {
  db = createNodeSqlDb(':memory:');
  await db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY AUTOINCREMENT, v TEXT)');
  return db;
}

describe('createNodeSqlDb', () => {
  it('run returns changes and lastInsertRowid', async () => {
    const d = await fresh();
    const r = await d.run('INSERT INTO t (v) VALUES (?)', ['a']);
    expect(r.changes).toBe(1);
    expect(r.lastInsertRowid).toBe(1);
  });

  it('query returns typed rows', async () => {
    const d = await fresh();
    await d.run('INSERT INTO t (v) VALUES (?)', ['a']);
    const rows = await d.query<{ id: number; v: string }>('SELECT * FROM t WHERE v = ?', ['a']);
    expect(rows).toEqual([{ id: 1, v: 'a' }]);
  });

  it('transaction commits on success and returns the value', async () => {
    const d = await fresh();
    const out = await d.transaction(async (tx) => {
      await tx.run('INSERT INTO t (v) VALUES (?)', ['x']);
      return 42;
    });
    expect(out).toBe(42);
    expect(await d.query('SELECT * FROM t')).toHaveLength(1);
  });

  it('transaction rolls back every statement when fn throws', async () => {
    const d = await fresh();
    await expect(
      d.transaction(async (tx) => {
        await tx.run('INSERT INTO t (v) VALUES (?)', ['x']);
        await tx.run('INSERT INTO t (v) VALUES (?)', ['y']);
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await d.query('SELECT * FROM t')).toHaveLength(0);
  });

  it('nested transaction reuses the outer tx (no second BEGIN)', async () => {
    const d = await fresh();
    await d.transaction(async (tx) => {
      await tx.transaction(async (inner) => {
        await inner.run('INSERT INTO t (v) VALUES (?)', ['n']);
      });
    });
    expect(await d.query('SELECT * FROM t')).toHaveLength(1);
  });

  it('nested failure rolls back the whole outer transaction', async () => {
    const d = await fresh();
    await expect(
      d.transaction(async (tx) => {
        await tx.run('INSERT INTO t (v) VALUES (?)', ['a']);
        await tx.transaction(async () => {
          throw new Error('inner');
        });
      }),
    ).rejects.toThrow('inner');
    expect(await d.query('SELECT * FROM t')).toHaveLength(0);
  });
});
