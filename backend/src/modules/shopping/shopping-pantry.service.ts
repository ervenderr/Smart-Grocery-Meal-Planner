/**
 * Applies the bought-it merge plan to the user's pantry in one transaction.
 * Runs after the finish transaction has committed (see shopping.controller).
 */

import { prisma } from '../../config/database.config';
import { planPantryMerge } from './shopping-pantry';
import type { CheckedItem } from './shopping-pantry';

export const PANTRY_MERGE_READ_CAP = 2000;

const utcMidnight = (d: Date): Date =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

export async function applyPantryMerge(
  userId: string,
  checked: readonly CheckedItem[],
  purchaseDate: Date,
): Promise<{ added: number; merged: number }> {
  const lots = await prisma.pantryItem.findMany({
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

  const plan = planPantryMerge({ checked, lots, purchaseDate, todayUtc: utcMidnight(new Date()) });
  if (plan.updates.length === 0 && plan.creates.length === 0) return { added: 0, merged: 0 };

  await prisma.$transaction([
    ...plan.updates.map((u) =>
      prisma.pantryItem.updateMany({
        where: { id: u.id, userId },
        data: { quantity: u.quantity },
      }),
    ),
    prisma.pantryItem.createMany({
      data: plan.creates.map((c) => ({ ...c, userId })),
    }),
  ]);
  return { added: plan.added, merged: plan.merged };
}
