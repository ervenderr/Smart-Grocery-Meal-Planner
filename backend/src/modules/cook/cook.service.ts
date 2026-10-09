/**
 * Cook service: "Cooked it" preview and apply for a recipe (CAP-04).
 * All pantry reads are userId-scoped; the client never supplies stock values.
 */

import { prisma } from '../../config/database.config';
import { AppError } from '../../middleware/errorHandler';
import type {
  CookApplyInput,
  CookApplyResponse,
  CookPreviewInput,
  CookPreviewResponse,
} from '../../types/cook.types';
import { resolveStaples } from '../intelligence/staples';
import { COOK_ERROR_CODES, COOK_PANTRY_READ_CAP } from './cook.constants';
import { alreadyCooked, mealNotFound, resolveCookTarget } from './cook.target';
import { CookLot, CookUnitMismatchError, allocateDeduction, computeCookPlan } from './cook.plan';

const PANTRY_LOT_SELECT = {
  id: true,
  ingredientName: true,
  quantity: true,
  unit: true,
  expiryDate: true,
  createdAt: true,
} as const;

const utcMidnight = (now: Date): Date =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

export async function previewCook(
  userId: string,
  input: CookPreviewInput,
): Promise<CookPreviewResponse> {
  const { recipe, defaultServings, mealPlanItem } = await resolveCookTarget(userId, input);
  const [lots, prefs] = await Promise.all([
    prisma.pantryItem.findMany({
      where: { userId, deletedAt: null },
      select: PANTRY_LOT_SELECT,
      orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }],
      take: COOK_PANTRY_READ_CAP,
    }),
    prisma.userPreference.findUnique({ where: { userId }, select: { stapleNames: true } }),
  ]);
  const servings = input.servings ?? defaultServings;
  const plan = computeCookPlan({
    recipe,
    servings,
    lots,
    staples: resolveStaples(prefs?.stapleNames),
    todayUtc: utcMidnight(new Date()),
  });
  return {
    recipe: { id: recipe.id, title: recipe.title, servings: recipe.servings },
    servings,
    ...plan,
    mealPlanItemId: mealPlanItem?.id ?? null,
    alreadyCooked: mealPlanItem?.cookedAt != null,
  };
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function applyDeductions(
  tx: Tx,
  userId: string,
  deductions: CookApplyInput['deductions'],
): Promise<CookApplyResponse> {
  const lots: CookLot[] = await tx.pantryItem.findMany({
    where: { userId, deletedAt: null },
    select: PANTRY_LOT_SELECT,
    orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }],
    take: COOK_PANTRY_READ_CAP,
  });
  const todayUtc = utcMidnight(new Date());
  let updated = 0;
  let usedUp = 0;
  let skipped = 0;
  for (const d of deductions) {
    if (d.use <= 0) continue;
    const result = allocateDeduction({ lots, key: d.key, unit: d.unit, use: d.use, todayUtc });
    if (result.updates.length === 0) {
      skipped += 1;
      continue;
    }
    for (const u of result.updates) {
      await tx.pantryItem.update({ where: { id: u.id }, data: { quantity: u.quantity } });
    }
    updated += result.updates.length;
    usedUp += result.usedUp;
  }
  return { updated, usedUp, skipped };
}

/**
 * Once-only marker: conditional update inside the apply transaction, so a replay
 * or concurrent double apply loses (409) and a later failure rolls it back.
 */
async function markMealCooked(tx: Tx, userId: string, mealPlanItemId: string): Promise<void> {
  const { count } = await tx.mealPlanItem.updateMany({
    where: { id: mealPlanItemId, cookedAt: null, mealPlan: { userId, deletedAt: null } },
    data: { cookedAt: new Date() },
  });
  if (count > 0) return;
  const existing = await tx.mealPlanItem.findFirst({
    where: { id: mealPlanItemId, mealPlan: { userId, deletedAt: null } },
    select: { id: true },
  });
  throw existing ? alreadyCooked() : mealNotFound();
}

export async function applyCook(
  userId: string,
  input: CookApplyInput,
): Promise<CookApplyResponse> {
  const { mealPlanItem } = await resolveCookTarget(userId, input);
  try {
    return await prisma.$transaction(async (tx) => {
      if (mealPlanItem) await markMealCooked(tx, userId, mealPlanItem.id);
      return applyDeductions(tx, userId, input.deductions);
    });
  } catch (error) {
    if (error instanceof CookUnitMismatchError) {
      throw new AppError(error.message, 400, true, {
        code: COOK_ERROR_CODES.DEDUCTION_UNIT_MISMATCH,
      });
    }
    throw error;
  }
}
