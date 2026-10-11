import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createNodeSqlDb } from '../sql/node-sqldb.test-helper';
import { migrate } from '../sql/migrations';
import type { SqlDb } from '../sql/types';
import { readCacheMeta, writeCacheMeta, wipeCache } from './cache-meta';

let db: SqlDb & { close(): void };
beforeEach(async () => {
  db = createNodeSqlDb();
  await migrate(db);
});
afterEach(() => db.close());

describe('cache-meta', () => {
  it('returns nulls on empty db', async () => {
    expect(await readCacheMeta(db)).toEqual({ userId: null, lastBootstrapAt: null });
  });
  it('round-trips and merges patches', async () => {
    await writeCacheMeta(db, { userId: 'u1' });
    await writeCacheMeta(db, { lastBootstrapAt: '2026-01-01T00:00:00Z' });
    expect(await readCacheMeta(db)).toEqual({ userId: 'u1', lastBootstrapAt: '2026-01-01T00:00:00Z' });
  });
  it('wipeCache clears cache tables but keeps outbox', async () => {
    await writeCacheMeta(db, { userId: 'u1' });
    await db.run(
      'INSERT INTO cache_entries (key_hash,key_json,state_json,user_id,updated_at) VALUES (?,?,?,?,?)',
      ['h', '[]', '{}', 'u1', 1],
    );
    await db.run(
      `INSERT INTO outbox (op_id,idempotency_key,user_id,kind,entity_type,entity_id,payload_json,label,state,created_at,updated_at)
       VALUES ('o','i','u1','k','e','1','{}','l','queued',1,1)`,
    );
    await wipeCache(db);
    expect(await db.query('SELECT * FROM cache_entries')).toHaveLength(0);
    expect(await db.query('SELECT * FROM cache_meta')).toHaveLength(0);
    expect(await db.query('SELECT * FROM outbox')).toHaveLength(1);
  });
});
