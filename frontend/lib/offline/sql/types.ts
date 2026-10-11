export interface SqlRunResult {
  changes: number;
  lastInsertRowid?: number;
}

/**
 * The only way offline code touches SQLite. Params are positional `?` only.
 * Never build SQL strings from user data.
 */
export interface SqlDb {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: readonly unknown[]): Promise<SqlRunResult>;
  query<T>(sql: string, params?: readonly unknown[]): Promise<T[]>;
  transaction<T>(fn: (tx: SqlDb) => Promise<T>): Promise<T>;
}
