/**
 * Per-purchase and per-user advisory transaction locks (WR-02).
 *
 * The claim (/verify) and the App Store webhook both read the entitlement,
 * compare signedDate with lastSignedAt, then write. Under READ COMMITTED two
 * of them could read the same row and the older one could win the write, e.g.
 * a pre-refund JWS undoing a REFUND. Both paths take these locks first, so
 * the read-compare-write runs one at a time per purchase and per user.
 *
 * Lock order is always purchase, then user. Advisory xact locks are re-entrant
 * within one transaction and are released at commit/rollback.
 */

import type { Prisma } from '@prisma/client';

export async function lockPurchase(
  tx: Prisma.TransactionClient,
  environment: string,
  originalTransactionId: string,
): Promise<void> {
  const key = `entitlement:purchase:${environment}:${originalTransactionId}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
}

export async function lockUserEntitlement(tx: Prisma.TransactionClient, userId: string): Promise<void> {
  const key = `entitlement:user:${userId}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
}
