import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb, resetDbForTests, type SqliteModuleLike } from './get-db';
import { createNativeSqlDb, type NativeConnectionLike } from './native-sqldb';

function fakeConn(overrides: Partial<NativeConnectionLike> = {}): NativeConnectionLike {
  return {
    open: vi.fn(async () => undefined),
    execute: vi.fn(async () => ({ changes: { changes: 0 } })),
    run: vi.fn(async () => ({ changes: { changes: 1, lastId: 7 } })),
    query: vi.fn(async () => ({ values: [{ a: 1 }] })),
    beginTransaction: vi.fn(async () => ({})),
    commitTransaction: vi.fn(async () => ({})),
    rollbackTransaction: vi.fn(async () => ({})),
    ...overrides,
  };
}

function fakeModule(conn: NativeConnectionLike, existing = false, consistencyFails = false) {
  const sqlite = {
    checkConnectionsConsistency: vi.fn(async () => {
      if (consistencyFails) throw new Error('inconsistent');
      return { result: true };
    }),
    isConnection: vi.fn(async () => ({ result: existing })),
    retrieveConnection: vi.fn(async () => conn),
    createConnection: vi.fn(async () => conn),
  };
  const mod: SqliteModuleLike = { sqlite };
  return { mod, sqlite };
}

beforeEach(() => {
  resetDbForTests();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('getDb', () => {
  it('returns null when the plugin is unavailable (web)', async () => {
    expect(await getDb({ loadSqlite: async () => null })).toBeNull();
  });

  it('memoizes concurrent calls and creates one connection', async () => {
    const { mod, sqlite } = fakeModule(fakeConn());
    const [a, b] = await Promise.all([
      getDb({ loadSqlite: async () => mod }),
      getDb({ loadSqlite: async () => mod }),
    ]);
    expect(a).not.toBeNull();
    expect(a).toBe(b);
    expect(sqlite.createConnection).toHaveBeenCalledTimes(1);
    expect(sqlite.createConnection).toHaveBeenCalledWith('kitcha', false, 'no-encryption', 1, false);
  });

  it('reuses an existing connection after a WebView reload', async () => {
    const conn = fakeConn();
    const { mod, sqlite } = fakeModule(conn, true);
    await getDb({ loadSqlite: async () => mod });
    expect(sqlite.retrieveConnection).toHaveBeenCalledWith('kitcha', false);
    expect(sqlite.createConnection).not.toHaveBeenCalled();
  });

  it('logs kind only and still opens when consistency check throws', async () => {
    const conn = fakeConn();
    const { mod } = fakeModule(conn, false, true);
    const db = await getDb({ loadSqlite: async () => mod });
    expect(db).not.toBeNull();
    expect(conn.open).toHaveBeenCalledTimes(1);
    expect(JSON.stringify((console.error as ReturnType<typeof vi.fn>).mock.calls)).not.toContain('kitcha');
  });

  it('resolves null when open fails', async () => {
    const conn = fakeConn({ open: vi.fn(async () => { throw new Error('boom'); }) });
    const { mod } = fakeModule(conn);
    expect(await getDb({ loadSqlite: async () => mod })).toBeNull();
  });

  it('resolves null when the loader rejects', async () => {
    expect(await getDb({ loadSqlite: async () => { throw new Error('x'); } })).toBeNull();
  });
});

describe('createNativeSqlDb', () => {
  it('maps run changes and lastId', async () => {
    const db = createNativeSqlDb(fakeConn());
    expect(await db.run('INSERT INTO t VALUES (?)', [1])).toEqual({ changes: 1, lastInsertRowid: 7 });
  });

  it('defaults missing run changes to 0', async () => {
    const db = createNativeSqlDb(fakeConn({ run: vi.fn(async () => ({})) }));
    expect(await db.run('x')).toEqual({ changes: 0, lastInsertRowid: undefined });
  });

  it('query returns values or []', async () => {
    expect(await createNativeSqlDb(fakeConn()).query('select 1')).toEqual([{ a: 1 }]);
    const empty = createNativeSqlDb(fakeConn({ query: vi.fn(async () => ({})) }));
    expect(await empty.query('select 1')).toEqual([]);
  });

  it('exec delegates to execute', async () => {
    const conn = fakeConn();
    await createNativeSqlDb(conn).exec('CREATE TABLE t(a)');
    expect(conn.execute).toHaveBeenCalledWith('CREATE TABLE t(a)', true);
  });

  it('transaction commits on success and runs statements without their own transaction', async () => {
    const conn = fakeConn();
    const db = createNativeSqlDb(conn);
    const out = await db.transaction(async (tx) => {
      await tx.run('INSERT', []);
      await tx.exec('DDL');
      return 5;
    });
    expect(out).toBe(5);
    expect(conn.beginTransaction).toHaveBeenCalledTimes(1);
    expect(conn.commitTransaction).toHaveBeenCalledTimes(1);
    expect(conn.run).toHaveBeenCalledWith('INSERT', [], false);
    expect(conn.execute).toHaveBeenCalledWith('DDL', false);
  });

  it('transaction rolls back and rethrows on failure', async () => {
    const conn = fakeConn();
    const db = createNativeSqlDb(conn);
    await expect(db.transaction(async () => { throw new Error('bad'); })).rejects.toThrow('bad');
    expect(conn.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(conn.commitTransaction).not.toHaveBeenCalled();
  });

  it('nested transaction joins the outer one', async () => {
    const conn = fakeConn();
    await createNativeSqlDb(conn).transaction((tx) => tx.transaction(async () => 1));
    expect(conn.beginTransaction).toHaveBeenCalledTimes(1);
  });
});
