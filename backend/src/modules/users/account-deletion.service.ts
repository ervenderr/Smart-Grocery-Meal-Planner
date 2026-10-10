/**
 * Permanent account deletion (STORE-01, Apple 5.1.1(v)).
 *
 * meal_plan_items.recipe_id is ON DELETE RESTRICT, so plan items must be removed
 * before the user's recipes are cascaded. ai_usage has no FK to users, so the
 * user's quota rows are deleted explicitly.
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
    await tx.mealPlanItem.deleteMany({ where: { mealPlan: { userId } } });
    await tx.aiUsage.deleteMany({ where: { scope: `user:${userId}` } });
    await tx.user.delete({ where: { id: userId } });
  });

  logger.warn('User account permanently deleted', { userId });
}
