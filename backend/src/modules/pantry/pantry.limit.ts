/**
 * Free-tier pantry cap (12-07, SUB-02/SUB-03).
 *
 * Every path that creates pantry rows for a user takes the per-user advisory
 * lock, then counts active rows and inserts inside the same transaction. The
 * row-level lock in pantry.lock.ts does not stop concurrent INSERTs, so the
 * advisory lock is what makes count-then-insert atomic.
 */

import type { Prisma } from "@prisma/client";
import { AppError } from "../../middleware/errorHandler";
import {
  ENTITLEMENT_ERROR_CODES,
  PANTRY_LIMIT_FEATURE,
} from "../entitlements/entitlements.constants";
import { isEntitled } from "../entitlements/entitlement-status";

export async function lockPantryCap(
  tx: Prisma.TransactionClient,
  userId: string
): Promise<void> {
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtextextended(${"pantry-cap:" + userId}, 0))`;
}

/**
 * Throws 403 UPGRADE_REQUIRED when a free user would exceed `limit` active
 * pantry items by adding `adding` rows. Call lockPantryCap first.
 */
export async function assertPantryCapacity(
  tx: Prisma.TransactionClient,
  userId: string,
  limit: number,
  adding: number = 1
): Promise<void> {
  if (adding <= 0) return;
  if (await isEntitled(userId, tx)) return;

  const current = await tx.pantryItem.count({
    where: { userId, deletedAt: null },
  });
  if (current + adding > limit) {
    throw new AppError("Free pantry limit reached", 403, true, {
      code: ENTITLEMENT_ERROR_CODES.UPGRADE_REQUIRED,
      details: { limit, current, adding, feature: PANTRY_LIMIT_FEATURE },
    });
  }
}
