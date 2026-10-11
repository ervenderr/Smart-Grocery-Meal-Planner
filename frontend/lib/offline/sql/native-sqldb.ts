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
type Serial = <T>(task: () => Promise<T>) => Promise<T>;

/** The plugin has one connection: overlapping transactions fail, so top-level writes run one at a time. */
function createSerial(): Serial {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(task: () => Promise<T>): Promise<T> => {
    const result = tail.then(task, task);
    tail = result.catch(() => undefined);
    return result;
  };
}

function build(conn: NativeConnectionLike, inTx: boolean, serial: Serial): SqlDb {
  const own = !inTx;
  const guard: Serial = inTx ? (task) => task() : serial;
  const self: SqlDb = {
    async exec(sql) {
      await guard(() => conn.execute(sql, own));
    },
    async run(sql, params = []): Promise<SqlRunResult> {
      const res = await guard(() => conn.run(sql, [...params], own));
      return { changes: res.changes?.changes ?? 0, lastInsertRowid: res.changes?.lastId };
    },
    async query<T>(sql: string, params: readonly unknown[] = []): Promise<T[]> {
      const res = await conn.query(sql, [...params]);
      return (res.values ?? []) as T[];
    },
    async transaction<T>(fn: (tx: SqlDb) => Promise<T>): Promise<T> {
      if (inTx) return fn(self);
      return serial(async () => {
        await conn.beginTransaction();
        try {
          const out = await fn(build(conn, true, serial));
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
      });
    },
  };
  return self;
}

export function createNativeSqlDb(conn: NativeConnectionLike): SqlDb {
  return build(conn, false, createSerial());
}
