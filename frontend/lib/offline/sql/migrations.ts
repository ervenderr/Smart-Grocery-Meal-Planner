import type { SqlDb } from './types';
import {
  CACHE_DDL,
  CACHE_DROP_DDL,
  CACHE_SCHEMA_VERSION,
  OUTBOX_DDL_V1,
  OUTBOX_SCHEMA_VERSION,
  SCHEMA_META_DDL,
} from './schema';

export interface MigrationResult {
  cacheFrom: number | null;
  cacheTo: number;
  outboxFrom: number | null;
  outboxTo: number;
  cacheWiped: boolean;
}

export class OutboxDowngradeError extends Error {
  constructor(stored: number, target: number) {
    super(`Outbox schema v${stored} is newer than this app supports (v${target})`);
    this.name = 'OutboxDowngradeError';
  }
}

/** Forward steps indexed by target version. Index 1 is the base DDL. Never drop tables here. */
const OUTBOX_MIGRATIONS: readonly (string | null)[] = [null, OUTBOX_DDL_V1];

async function readVersion(db: SqlDb, name: string): Promise<number | null> {
  const rows = await db.query<{ version: number }>('SELECT version FROM schema_meta WHERE name = ?', [name]);
  return rows.length > 0 ? rows[0].version : null;
}

async function writeVersion(db: SqlDb, name: string, version: number): Promise<void> {
  await db.run(
    'INSERT INTO schema_meta (name, version) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET version = excluded.version',
    [name, version],
  );
}

async function applyOutboxSteps(db: SqlDb, from: number | null, to: number): Promise<void> {
  await db.exec(OUTBOX_DDL_V1); // IF NOT EXISTS; safe for any stored version
  for (let v = Math.max((from ?? 1) + 1, 2); v <= to; v += 1) {
    const step = OUTBOX_MIGRATIONS[v];
    if (step) await db.exec(step);
  }
}

export async function migrate(
  db: SqlDb,
  versions: { cache: number; outbox: number } = { cache: CACHE_SCHEMA_VERSION, outbox: OUTBOX_SCHEMA_VERSION },
): Promise<MigrationResult> {
  return db.transaction(async (tx) => {
    await tx.exec(SCHEMA_META_DDL);
    const cacheFrom = await readVersion(tx, 'cache');
    const outboxFrom = await readVersion(tx, 'outbox');
    if (outboxFrom !== null && outboxFrom > versions.outbox) {
      throw new OutboxDowngradeError(outboxFrom, versions.outbox);
    }
    const cacheWiped = cacheFrom !== null && cacheFrom !== versions.cache;
    if (cacheWiped) await tx.exec(CACHE_DROP_DDL);
    await tx.exec(CACHE_DDL);
    await applyOutboxSteps(tx, outboxFrom, versions.outbox);
    await writeVersion(tx, 'cache', versions.cache);
    await writeVersion(tx, 'outbox', versions.outbox);
    return { cacheFrom, cacheTo: versions.cache, outboxFrom, outboxTo: versions.outbox, cacheWiped };
  });
}
