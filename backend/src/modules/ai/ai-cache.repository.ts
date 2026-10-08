/**
 * Generic Postgres-backed cache for validated payloads. Reused by food lookups.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database.config';
import { logger } from '../../config/logger.config';

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

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Cache read that degrades to a miss (null) on any DB failure. */
export async function getCachedSafe(key: string, now: Date): Promise<unknown | null> {
  try {
    return await getCached(key, now);
  } catch (error) {
    logger.warn('Cache read failed, treating as miss', { error: describeError(error) });
    return null;
  }
}

/** Cache write that never throws; returns whether the write succeeded. */
export async function setCachedSafe(input: SetCachedInput): Promise<boolean> {
  try {
    await setCached(input);
    return true;
  } catch (error) {
    logger.warn('Cache write failed, result not cached', {
      feature: input.feature,
      error: describeError(error),
    });
    return false;
  }
}
