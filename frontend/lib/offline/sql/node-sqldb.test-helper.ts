// Tests only. Never import from app code.
import { DatabaseSync } from 'node:sqlite';
import type { SqlDb, SqlRunResult } from './types';

type Param = null | number | bigint | string | Uint8Array;

export function createNodeSqlDb(path = ':memory:'): SqlDb & { close(): void } {
  const handle = new DatabaseSync(path);
  let depth = 0;

  const bind = (params?: readonly unknown[]): Param[] => [...(params ?? [])] as Param[];

  const db: SqlDb & { close(): void } = {
    async exec(sql) {
      handle.exec(sql);
    },
    async run(sql, params): Promise<SqlRunResult> {
      const r = handle.prepare(sql).run(...bind(params));
      return { changes: Number(r.changes), lastInsertRowid: Number(r.lastInsertRowid) };
    },
    async query<T>(sql: string, params?: readonly unknown[]): Promise<T[]> {
      return handle.prepare(sql).all(...bind(params)).map((row) => ({ ...row }) as T);
    },
    async transaction<T>(fn: (tx: SqlDb) => Promise<T>): Promise<T> {
      if (depth > 0) return fn(db);
      handle.exec('BEGIN');
      depth += 1;
      try {
        const out = await fn(db);
        handle.exec('COMMIT');
        return out;
      } catch (err) {
        handle.exec('ROLLBACK');
        throw err;
      } finally {
        depth -= 1;
      }
    },
    close() {
      handle.close();
    },
  };
  return db;
}
