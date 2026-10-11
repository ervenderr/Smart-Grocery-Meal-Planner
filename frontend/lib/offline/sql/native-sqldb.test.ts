import { describe, expect, it } from 'vitest';
import { createNativeSqlDb, type NativeConnectionLike } from './native-sqldb';

/** Fake connection that fails like SQLite when a transaction overlaps another. */
function fakeConn(log: string[] = []) {
  let open = false;
  const tick = () => new Promise<void>((r) => setTimeout(r, 1));
  const conn: NativeConnectionLike = {
    open: async () => undefined,
    execute: async (sql, own) => {
      await tick();
      if (own && open) throw new Error('cannot start a transaction within a transaction');
      log.push(`exec:${sql}`);
      return {};
    },
    run: async (sql, _v, own) => {
      await tick();
      if (own && open) throw new Error('cannot start a transaction within a transaction');
      log.push(`run:${sql}`);
      return { changes: { changes: 1 } };
    },
    query: async (sql) => {
      await tick();
      log.push(`query:${sql}${open ? ':in-tx' : ''}`);
      return { values: [] };
    },
    beginTransaction: async () => {
      await tick();
      if (open) throw new Error('cannot start a transaction within a transaction');
      open = true;
      log.push('begin');
      return undefined;
    },
    commitTransaction: async () => {
      await tick();
      open = false;
      log.push('commit');
      return undefined;
    },
    rollbackTransaction: async () => {
      open = false;
      log.push('rollback');
      return undefined;
    },
  };
  return { conn, log };
}

describe('createNativeSqlDb serialization', () => {
  it('runs concurrent transactions one after another', async () => {
    const { conn, log } = fakeConn();
    const db = createNativeSqlDb(conn);
    await Promise.all([
      db.transaction(async (tx) => void (await tx.run('A'))),
      db.transaction(async (tx) => void (await tx.run('B'))),
    ]);
    expect(log).toEqual(['begin', 'run:A', 'commit', 'begin', 'run:B', 'commit']);
  });

  it('does not let a top-level write overlap an open transaction', async () => {
    const { conn, log } = fakeConn();
    const db = createNativeSqlDb(conn);
    await Promise.all([
      db.transaction(async (tx) => void (await tx.run('A'))),
      db.run('solo'),
    ]);
    expect(log).toEqual(['begin', 'run:A', 'commit', 'run:solo']);
  });

  it('keeps going after a failed transaction', async () => {
    const { conn, log } = fakeConn();
    const db = createNativeSqlDb(conn);
    const failing = db.transaction(async () => {
      throw new Error('boom');
    });
    const next = db.transaction(async (tx) => void (await tx.run('B')));
    await expect(failing).rejects.toThrow('boom');
    await next;
    expect(log).toEqual(['begin', 'rollback', 'begin', 'run:B', 'commit']);
  });

  it('nested tx calls reuse the open transaction', async () => {
    const { conn, log } = fakeConn();
    const db = createNativeSqlDb(conn);
    await db.transaction((tx) => tx.transaction(async (inner) => void (await inner.run('N'))));
    expect(log).toEqual(['begin', 'run:N', 'commit']);
  });

  it('a top-level read never runs inside another task\'s open transaction (WR-01)', async () => {
    const { conn, log } = fakeConn();
    const db = createNativeSqlDb(conn);
    let outer: Promise<unknown> = Promise.resolve();
    await db.transaction(async (tx) => {
      await tx.run('A');
      outer = db.query('SELECT 1'); // another task reads while this transaction is open
      await tx.run('B');
    });
    await outer;
    expect(log).toEqual(['begin', 'run:A', 'run:B', 'commit', 'query:SELECT 1']);
  });

  it('a read inside the transaction still runs directly', async () => {
    const { conn, log } = fakeConn();
    const db = createNativeSqlDb(conn);
    await db.transaction(async (tx) => void (await tx.query('SELECT 2')));
    expect(log).toEqual(['begin', 'query:SELECT 2:in-tx', 'commit']);
  });
});
