/**
 * Daily prune of expired idempotency keys and stale refresh tokens.
 */

import { prisma } from '@/config/database.config';
import { logger } from '@/config/logger.config';

export const REVOKED_REFRESH_RETENTION_DAYS = 7;
export const SYNC_CLEANUP_CRON = '30 3 * * *';

const DAY_MS = 86_400_000;

export interface PruneResult {
  readonly idempotencyKeys: number;
  readonly refreshTokens: number;
}

/**
 * Revoked tokens are kept for a retention window so reuse detection keeps working.
 */
export async function pruneExpiredSyncRows(now: Date = new Date()): Promise<PruneResult> {
  const revokedCutoff = new Date(now.getTime() - REVOKED_REFRESH_RETENTION_DAYS * DAY_MS);

  const [keys, tokens] = await Promise.all([
    prisma.idempotencyKey.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.refreshToken.deleteMany({
      where: { OR: [{ expiresAt: { lt: now } }, { revokedAt: { lt: revokedCutoff } }] },
    }),
  ]);

  return { idempotencyKeys: keys.count, refreshTokens: tokens.count };
}

async function runSyncCleanup(): Promise<void> {
  try {
    const result = await pruneExpiredSyncRows();
    logger.info('Sync cleanup complete', {
      service: 'kitcha-api',
      module: 'sync-cleanup',
      ...result,
    });
  } catch (error) {
    logger.error('Sync cleanup failed', {
      service: 'kitcha-api',
      module: 'sync-cleanup',
      error: (error as Error).message,
    });
  }
}

export function initializeSyncCleanup(): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const cron = require('node-cron');
    cron.schedule(SYNC_CLEANUP_CRON, () => {
      void runSyncCleanup();
    });
    logger.info('Sync cleanup scheduled', {
      service: 'kitcha-api',
      module: 'sync-cleanup',
      schedule: SYNC_CLEANUP_CRON,
    });
  } catch (error) {
    logger.warn('node-cron unavailable, sync cleanup disabled', {
      service: 'kitcha-api',
      module: 'sync-cleanup',
      error: (error as Error).message,
    });
  }
}
