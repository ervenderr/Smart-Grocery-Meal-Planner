import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import type { SqliteConnectionLike, SqliteModuleLike } from './get-db';

/** Only reachable through a native-build-gated dynamic import (keeps the plugin out of web). */
export function loadNativeSqlite(): SqliteModuleLike {
  const sqlite = new SQLiteConnection(CapacitorSQLite);
  return { sqlite: sqlite as unknown as SqliteConnectionLike };
}
