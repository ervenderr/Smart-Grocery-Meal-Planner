export const DB_NAME = 'kitcha';
export const CACHE_SCHEMA_VERSION = 1;
export const OUTBOX_SCHEMA_VERSION = 1;

export const TABLES = {
  cacheMeta: 'cache_meta',
  cacheEntries: 'cache_entries',
  outbox: 'outbox',
  barcodeCache: 'barcode_cache',
  pendingScan: 'pending_scan',
  schemaMeta: 'schema_meta',
} as const;

export const OUTBOX_STATES = ['queued', 'in_flight', 'failed', 'blocked', 'paused_auth'] as const;
export type OutboxState = (typeof OUTBOX_STATES)[number];

const STATE_LIST = OUTBOX_STATES.map((s) => `'${s}'`).join(', ');

export const SCHEMA_META_DDL = `CREATE TABLE IF NOT EXISTS schema_meta (
  name TEXT PRIMARY KEY, version INTEGER NOT NULL)`;

/** Cache tables: safe to drop and rebuild. */
export const CACHE_DROP_DDL = `
DROP TABLE IF EXISTS cache_meta;
DROP TABLE IF EXISTS cache_entries;
DROP TABLE IF EXISTS barcode_cache;`;

export const CACHE_DDL = `
CREATE TABLE IF NOT EXISTS cache_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS cache_entries (
  key_hash TEXT PRIMARY KEY, key_json TEXT NOT NULL, state_json TEXT NOT NULL,
  user_id TEXT NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS barcode_cache (
  barcode TEXT NOT NULL, user_id TEXT NOT NULL, found INTEGER NOT NULL, product_json TEXT,
  fetched_at INTEGER NOT NULL, last_used_at INTEGER NOT NULL, PRIMARY KEY (user_id, barcode));`;

/** Unsynced user work: never dropped. */
export const OUTBOX_DDL_V1 = `
CREATE TABLE IF NOT EXISTS outbox (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  op_id TEXT NOT NULL UNIQUE,
  idempotency_key TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  inverse_json TEXT,
  resolved_json TEXT,
  label TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN (${STATE_LIST})),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error_json TEXT,
  next_attempt_at INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  op_version INTEGER NOT NULL DEFAULT 1);
CREATE INDEX IF NOT EXISTS idx_outbox_user_state_seq ON outbox (user_id, state, seq);
CREATE INDEX IF NOT EXISTS idx_outbox_user_entity ON outbox (user_id, entity_type, entity_id);
CREATE TABLE IF NOT EXISTS pending_scan (
  pantry_item_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, barcode TEXT NOT NULL,
  created_at INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, resolved_at INTEGER);`;
