/**
 * Applies the bought-it merge plan to the user's pantry inside the caller's
 * transaction (the finish transaction, see shopping-finish.service), so a
 * merge failure rolls the whole finish back.
 */

import type { Prisma } from '@prisma/client';
import { lockUserPantry } from '../pantry/pantry.lock';
import { assertPantryCapacity, lockPantryCap } from '../pantry/pantry.limit';
import { config } from '../../config/env.config';
import { planPantryMerge } from './shopping-pantry';
import type { CheckedItem } from './shopping-pantry';

export const PANTRY_MERGE_READ_CAP = 2000;

const utcMidnight = (d: Date): Date =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

export async function applyPantryMergeInTx(
  tx: Prisma.TransactionClient,
  userId: string,
  checked: readonly CheckedItem[],
  purchaseDate: Date,
): Promise<{ added: number; merged: number }> {
  // Read, plan and write under the pantry lock so a concurrent edit or
  // cook between the read and the write cannot be overwritten.
  {
    await lockUserPantry(tx, userId);
    const lots = await tx.pantryItem.findMany({
      where: { userId, deletedAt: null },
      select: {
        id: true,
        ingredientName: true,
        quantity: true,
        unit: true,
        expiryDate: true,
        createdAt: true,
      },
      orderBy: [{ expiryDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
      take: PANTRY_MERGE_READ_CAP,
    });

    const plan = planPantryMerge({
      checked,
      lots,
      purchaseDate,
      todayUtc: utcMidnight(new Date()),
    });
    if (plan.updates.length === 0 && plan.creates.length === 0) return { added: 0, merged: 0 };

    // Free-tier cap (12-07): checked before any write so a 403 leaves the
    // finish transaction with nothing to roll back but the list state.
    if (plan.creates.length > 0) {
      await lockPantryCap(tx, userId);
      await assertPantryCapacity(
        tx,
        userId,
        config.entitlements.freePantryLimit,
        plan.creates.length,
      );
    }

    for (const u of plan.updates) {
      await tx.pantryItem.updateMany({
        where: { id: u.id, userId },
        data:
          u.expiryDate === null
            ? { quantity: u.quantity, expiryDate: null }
            : { quantity: u.quantity },
      });
    }
    await tx.pantryItem.createMany({ data: plan.creates.map((c) => ({ ...c, userId })) });
    return { added: plan.added, merged: plan.merged };
  }
}
