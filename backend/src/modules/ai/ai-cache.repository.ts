/**
 * Generic Postgres-backed cache for validated payloads. Reused by food lookups.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database.config';

export interface SetCachedInput {
  readonly key: string;
  readonly feature: string;
  readonly schemaVersion: number;
  readonly payload: unknown;
  readonly ttlMs: number;
  readonly now: Date;
}

export async function getCached(key: string, now: Date): Promise<unknown | null> {
  const row = await prisma.aiCache.findUnique({ where: { key } });
  if (!row || row.expiresAt.getTime() <= now.getTime()) return null;
  return row.payload;
}

export async function setCached(input: SetCachedInput): Promise<void> {
  const payload = input.payload as Prisma.InputJsonValue;
  const expiresAt = new Date(input.now.getTime() + input.ttlMs);
  await prisma.aiCache.upsert({
    where: { key: input.key },
    create: {
      key: input.key,
      feature: input.feature,
      schemaVersion: input.schemaVersion,
      payload,
      createdAt: input.now,
      expiresAt,
    },
    update: {
      feature: input.feature,
      schemaVersion: input.schemaVersion,
      payload,
      createdAt: input.now,
      expiresAt,
    },
  });
}

export async function pruneExpired(now: Date): Promise<number> {
  const result = await prisma.aiCache.deleteMany({ where: { expiresAt: { lt: now } } });
  return result.count;
}
