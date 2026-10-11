import type { SqlDb } from '../sql/types';

export interface CacheMeta {
  userId: string | null;
  lastBootstrapAt: string | null;
}

const KEYS = { userId: 'user_id', lastBootstrapAt: 'last_bootstrap_at' } as const;

export async function readCacheMeta(db: SqlDb): Promise<CacheMeta> {
  const rows = await db.query<{ key: string; value: string }>('SELECT key, value FROM cache_meta');
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    userId: map.get(KEYS.userId) ?? null,
    lastBootstrapAt: map.get(KEYS.lastBootstrapAt) ?? null,
  };
}

export async function writeCacheMeta(db: SqlDb, patch: Partial<CacheMeta>): Promise<void> {
  const upsert =
    'INSERT INTO cache_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value';
  await db.transaction(async (tx) => {
    for (const field of Object.keys(KEYS) as (keyof typeof KEYS)[]) {
      const value = patch[field];
      if (value != null) await tx.run(upsert, [KEYS[field], value]);
    }
  });
}

export async function wipeCache(db: SqlDb): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.run('DELETE FROM cache_entries');
    await tx.run('DELETE FROM cache_meta');
    await tx.run('DELETE FROM barcode_cache');
  });
}
