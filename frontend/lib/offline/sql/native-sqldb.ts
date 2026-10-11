import type { SqlDb, SqlRunResult } from './types';

interface ChangesLike {
  changes?: { changes?: number; lastId?: number };
}

/** Narrow view of SQLiteDBConnection (only the methods used) so tests can fake it. */
export interface NativeConnectionLike {
  open(): Promise<void>;
  execute(statements: string, transaction?: boolean): Promise<ChangesLike>;
  run(statement: string, values?: unknown[], transaction?: boolean): Promise<ChangesLike>;
  query(statement: string, values?: unknown[]): Promise<{ values?: unknown[] }>;
  beginTransaction(): Promise<unknown>;
  commitTransaction(): Promise<unknown>;
  rollbackTransaction(): Promise<unknown>;
}

/**
 * Inside a manual transaction the plugin must not open its own (`transaction=false`);
 * outside one, the plugin's default per-call transaction (`true`) keeps writes atomic.
 */
function build(conn: NativeConnectionLike, inTx: boolean): SqlDb {
  const own = !inTx;
  const self: SqlDb = {
    async exec(sql) {
      await conn.execute(sql, own);
    },
    async run(sql, params = []): Promise<SqlRunResult> {
      const res = await conn.run(sql, [...params], own);
      return { changes: res.changes?.changes ?? 0, lastInsertRowid: res.changes?.lastId };
    },
    async query<T>(sql: string, params: readonly unknown[] = []): Promise<T[]> {
      const res = await conn.query(sql, [...params]);
      return (res.values ?? []) as T[];
    },
    async transaction<T>(fn: (tx: SqlDb) => Promise<T>): Promise<T> {
      if (inTx) return fn(self);
      await conn.beginTransaction();
      try {
        const out = await fn(build(conn, true));
        await conn.commitTransaction();
        return out;
      } catch (error) {
        try {
          await conn.rollbackTransaction();
        } catch {
          // rollback failure must not mask the original error
        }
        throw error;
      }
    },
  };
  return self;
}

export function createNativeSqlDb(conn: NativeConnectionLike): SqlDb {
  return build(conn, false);
}
