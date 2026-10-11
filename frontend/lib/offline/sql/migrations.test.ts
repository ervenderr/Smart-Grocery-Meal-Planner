import { afterEach, describe, expect, it } from 'vitest';
import { createNodeSqlDb } from './node-sqldb.test-helper';
import { migrate, OutboxDowngradeError } from './migrations';

let db = createNodeSqlDb(':memory:');
afterEach(() => db.close());

const fresh = () => {
  db = createNodeSqlDb(':memory:');
  return db;
};

const insertOutbox = (op: string, createdAt = 1, state = 'queued', key = `k-${op}`) =>
  db.run(
    `INSERT INTO outbox (op_id, idempotency_key, user_id, kind, entity_type, entity_id, payload_json, label, state, created_at, updated_at)
     VALUES (?, ?, 'u1', 'k', 'e', 'id', '{}', 'l', ?, ?, ?)`,
    [op, key, state, createdAt, createdAt],
  );

const tableNames = async () =>
  (await db.query<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table'")).map((r) => r.name);

describe('migrate', () => {
  it('creates all tables on an empty db', async () => {
    fresh();
    const res = await migrate(db);
    expect(res).toEqual({ cacheFrom: null, cacheTo: 1, outboxFrom: null, outboxTo: 1, cacheWiped: false });
    const names = await tableNames();
    for (const t of ['cache_meta', 'cache_entries', 'outbox', 'barcode_cache', 'pending_scan', 'schema_meta']) {
      expect(names).toContain(t);
    }
    const meta = await db.query<{ name: string; version: number }>('SELECT * FROM schema_meta ORDER BY name');
    expect(meta).toEqual([
      { name: 'cache', version: 1 },
      { name: 'outbox', version: 1 },
    ]);
  });

  it('is idempotent and keeps rows', async () => {
    fresh();
    await migrate(db);
    await insertOutbox('a');
    const res = await migrate(db);
    expect(res.cacheWiped).toBe(false);
    expect(res.cacheFrom).toBe(1);
    expect(await db.query('SELECT * FROM outbox')).toHaveLength(1);
  });

  it('cache version bump wipes cache tables but keeps outbox and pending_scan', async () => {
    fresh();
    await migrate(db);
    await db.run("INSERT INTO cache_meta (key, value) VALUES ('user_id', 'u1')");
    await db.run("INSERT INTO cache_entries VALUES ('h', '[]', '{}', 'u1', 1)");
    await db.run("INSERT INTO barcode_cache VALUES ('123', 'u1', 1, '{}', 1, 1)");
    await db.run("INSERT INTO pending_scan (pantry_item_id, user_id, barcode, created_at) VALUES ('p', 'u1', '123', 1)");
    await insertOutbox('a');
    const res = await migrate(db, { cache: 2, outbox: 1 });
    expect(res.cacheWiped).toBe(true);
    expect(res.cacheFrom).toBe(1);
    expect(res.cacheTo).toBe(2);
    expect(await db.query('SELECT * FROM cache_meta')).toHaveLength(0);
    expect(await db.query('SELECT * FROM cache_entries')).toHaveLength(0);
    expect(await db.query('SELECT * FROM barcode_cache')).toHaveLength(0);
    expect(await db.query('SELECT * FROM outbox')).toHaveLength(1);
    expect(await db.query('SELECT * FROM pending_scan')).toHaveLength(1);
  });

  it('rejects outbox downgrade and leaves tables intact', async () => {
    fresh();
    await migrate(db);
    await insertOutbox('a');
    await db.run("UPDATE schema_meta SET version = 2 WHERE name = 'outbox'");
    await expect(migrate(db, { cache: 1, outbox: 1 })).rejects.toBeInstanceOf(OutboxDowngradeError);
    expect(await db.query('SELECT * FROM outbox')).toHaveLength(1);
    const v = await db.query<{ version: number }>("SELECT version FROM schema_meta WHERE name='outbox'");
    expect(v[0].version).toBe(2);
  });

  it('outbox CHECK rejects unknown state', async () => {
    fresh();
    await migrate(db);
    await expect(insertOutbox('a', 1, 'bogus')).rejects.toThrow();
  });

  it('rejects duplicate op_id and duplicate idempotency_key', async () => {
    fresh();
    await migrate(db);
    await insertOutbox('a', 1, 'queued', 'k1');
    await expect(insertOutbox('a', 1, 'queued', 'k2')).rejects.toThrow();
    await expect(insertOutbox('b', 1, 'queued', 'k1')).rejects.toThrow();
  });

  it('orders by seq regardless of created_at', async () => {
    fresh();
    await migrate(db);
    await insertOutbox('a', 300);
    await insertOutbox('b', 100);
    await insertOutbox('c', 200);
    const rows = await db.query<{ op_id: string; seq: number }>('SELECT op_id, seq FROM outbox ORDER BY seq');
    expect(rows.map((r) => r.op_id)).toEqual(['a', 'b', 'c']);
    expect(rows[0].seq).toBeLessThan(rows[1].seq);
    expect(rows[1].seq).toBeLessThan(rows[2].seq);
  });

  it('applies forward outbox steps and records the new version', async () => {
    fresh();
    await migrate(db);
    await insertOutbox('a');
    const res = await migrate(db, { cache: 1, outbox: 1 });
    expect(res.outboxFrom).toBe(1);
    expect(res.outboxTo).toBe(1);
  });
});
