/**
 * Row-level lock over a user's live pantry lots.
 *
 * Cook-apply and the bought-it merge read lots, compute absolute quantities in
 * JS, then write them back. Without a lock a concurrent quick-edit PATCH or a
 * second apply between the read and the write is silently overwritten (lost
 * update under READ COMMITTED). Taking `FOR UPDATE` at the start of the
 * transaction serialises those writers. Rows are locked in id order so two
 * transactions for the same user cannot deadlock.
 */

import type { Prisma } from '@prisma/client';

export async function lockUserPantry(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  await tx.$queryRaw`
    SELECT id FROM pantry_items
    WHERE user_id = ${userId} AND deleted_at IS NULL
    ORDER BY id
    FOR UPDATE`;
}
