import { loadPlugin } from '@/lib/platform/native';
import { createNativeSqlDb, type NativeConnectionLike } from './native-sqldb';
import { DB_NAME } from './schema';
import type { SqlDb } from './types';

/** Narrow view of SQLiteConnection (the connection registry wrapper). */
export interface SqliteConnectionLike {
  checkConnectionsConsistency(): Promise<unknown>;
  isConnection(database: string, readonly: boolean): Promise<{ result?: boolean }>;
  retrieveConnection(database: string, readonly: boolean): Promise<NativeConnectionLike>;
  createConnection(
    database: string,
    encrypted: boolean,
    mode: string,
    version: number,
    readonly: boolean,
  ): Promise<NativeConnectionLike>;
}

export interface SqliteModuleLike {
  sqlite: SqliteConnectionLike;
}

export interface GetDbDeps {
  loadSqlite?: () => Promise<SqliteModuleLike | null>;
}

const DB_VERSION = 1;
let memo: Promise<SqlDb | null> | null = null;

async function productionLoader(): Promise<SqliteModuleLike | null> {
  // The inline env check is replaced at build time, so web builds drop the whole native loader chunk.
  const mod = await loadPlugin(() =>
    process.env.NEXT_PUBLIC_NATIVE_BUILD === '1'
      ? import('./native-sqlite-loader')
      : Promise.resolve(null),
  );
  return mod ? mod.loadNativeSqlite() : null;
}

async function openConnection(sqlite: SqliteConnectionLike): Promise<NativeConnectionLike> {
  try {
    await sqlite.checkConnectionsConsistency();
  } catch (error) {
    // Kind only: never log SQL or payloads.
    console.error('SQLite consistency check failed:', error instanceof Error ? error.name : 'unknown');
  }
  const existing = (await sqlite.isConnection(DB_NAME, false)).result === true;
  const conn = existing
    ? await sqlite.retrieveConnection(DB_NAME, false)
    : await sqlite.createConnection(DB_NAME, false, 'no-encryption', DB_VERSION, false);
  await conn.open();
  return conn;
}

async function init(deps: GetDbDeps): Promise<SqlDb | null> {
  try {
    const mod = await (deps.loadSqlite ?? productionLoader)();
    if (!mod) return null;
    return createNativeSqlDb(await openConnection(mod.sqlite));
  } catch (error) {
    console.error('SQLite open failed:', error instanceof Error ? error.name : 'unknown');
    return null;
  }
}

/** Memoized: one connection per WebView lifetime. Null on web or on plugin failure. */
export function getDb(deps: GetDbDeps = {}): Promise<SqlDb | null> {
  if (!memo) memo = init(deps);
  return memo;
}

export function resetDbForTests(): void {
  memo = null;
}
