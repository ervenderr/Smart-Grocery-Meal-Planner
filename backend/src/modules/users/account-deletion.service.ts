/**
 * Permanent account deletion (STORE-01, Apple 5.1.1(v)).
 *
 * meal_plan_items.recipe_id is ON DELETE RESTRICT, so plan items must be removed
 * before the user's recipes are cascaded. ai_usage has no FK to users, so the
 * user's quota rows are deleted explicitly. refresh_tokens and
 * idempotency_keys cascade via FK and are also deleted explicitly for clarity.
 */

import { prisma } from '@/config/database.config';
import { AppError } from '@/middleware/errorHandler';
import { comparePassword } from '@/utils/password.util';
import { logger } from '@/config/logger.config';

export const INVALID_PASSWORD_CODE = 'INVALID_PASSWORD';

export async function deleteAccountPermanently(
  userId: string,
  password: string
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  // 403 (not 401): the client treats 401 as "session expired" and logs out.
  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    throw new AppError('That password is incorrect. Try again.', 403, true, {
      code: INVALID_PASSWORD_CODE,
    });
  }

  await prisma.$transaction(async (tx) => {
    // Lock the user row first. Concurrent inserts of user-owned rows take a
    // FOR KEY SHARE lock on it via their FK, so they wait until we commit
    // (and then fail the FK) instead of sneaking a RESTRICT-bound row in
    // between the plan-item delete and the user delete.
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
    await tx.mealPlanItem.deleteMany({ where: { mealPlan: { userId } } });
    await tx.aiUsage.deleteMany({ where: { scope: `user:${userId}` } });
    await tx.refreshToken.deleteMany({ where: { userId } });
    await tx.idempotencyKey.deleteMany({ where: { userId } });
    // deleteMany: a concurrent duplicate request that lost the race deletes 0
    // rows and is treated as already deleted rather than throwing P2025.
    await tx.user.deleteMany({ where: { id: userId } });
  });

  logger.warn('User account permanently deleted', { userId });
}
