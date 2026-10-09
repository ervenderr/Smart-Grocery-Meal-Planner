/**
 * Generate a saved shopping list from a meal plan (merge into the active list).
 * Pipeline: aggregate (exact) -> drop staples -> subtract pantry -> merge.
 */

import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../config/database.config';
import { logger } from '../../config/logger.config';
import { AppError } from '../../middleware/errorHandler';
import type { GenerateFromMealPlanResult } from '../../types/shopping.types';
import { IngredientGroup, displayOf } from '../intelligence/merge-groups';
import { PantryStockItem, subtractPantry } from '../intelligence/pantry-subtract';
import { filterStaples, resolveStaples } from '../intelligence/staples';
import { aggregateGroups } from '../mealplan/mealplan.aggregate';
import { MAX_ITEMS_PER_LIST, SHOPPING_ERROR_CODES } from './shopping.constants';
import { IncomingItem, mergeIntoItems } from './shopping.merge';
import { bulkUpdateItems, ensureActiveListId, loadListDto } from './shopping.repository';

/** Explicit budget: the merge is a handful of statements, but allow slow links. */
const GENERATE_TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 20_000 } as const;

/** Max pantry rows compared per generate (soonest-expiring first). */
export const PANTRY_COMPARE_CAP = 2000;

export const isPantryCapped = (rowCount: number, cap: number): boolean => rowCount >= cap;

const planNotFound = (): AppError =>
  new AppError('Meal plan not found', 404, true, {
    code: SHOPPING_ERROR_CODES.MEAL_PLAN_NOT_FOUND,
  });

const planEmpty = (): AppError =>
  new AppError('This meal plan has no ingredients to add', 400, true, {
    code: SHOPPING_ERROR_CODES.MEAL_PLAN_EMPTY,
  });

const listFull = (): AppError =>
  new AppError(`Your list is full (${MAX_ITEMS_PER_LIST} items maximum)`, 400, true, {
    code: SHOPPING_ERROR_CODES.SHOPPING_LIST_FULL,
  });

const loadPlanGroups = async (userId: string, mealPlanId: string) => {
  const plan = await prisma.mealPlan.findFirst({
    where: { id: mealPlanId, userId, deletedAt: null },
    include: { mealPlanItems: { include: { recipe: true } } },
  });
  if (!plan) throw planNotFound();
  const aggregated = aggregateGroups(plan.mealPlanItems);
  if (aggregated.ingredientCount === 0) throw planEmpty();
  return aggregated.groups;
};

const loadUserContext = async (userId: string) => {
  const [pref, pantry] = await Promise.all([
    prisma.userPreference.findUnique({ where: { userId }, select: { stapleNames: true } }),
    prisma.pantryItem.findMany({
      where: { userId, deletedAt: null, quantity: { gt: 0 } },
      select: { ingredientName: true, quantity: true, unit: true, expiryDate: true },
      orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }],
      take: PANTRY_COMPARE_CAP,
    }),
  ]);
  const pantryCapped = isPantryCapped(pantry.length, PANTRY_COMPARE_CAP);
  if (pantryCapped) logger.warn('Pantry compare cap reached', { userId, cap: PANTRY_COMPARE_CAP });
  return { staples: resolveStaples(pref?.stapleNames), pantry: pantry as PantryStockItem[], pantryCapped };
};

const toIncoming = (groups: readonly IngredientGroup[]): IncomingItem[] =>
  groups.map((g) => {
    const { quantity, unit } = displayOf(g);
    return { itemName: g.displayName, quantity, unit };
  });

const utcMidnight = (): Date => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

export async function generateFromMealPlan(
  userId: string,
  mealPlanId: string,
): Promise<GenerateFromMealPlanResult> {
  const groups = await loadPlanGroups(userId, mealPlanId);
  const { staples, pantry, pantryCapped } = await loadUserContext(userId);
  const { kept, skipped } = filterStaples(groups, staples);
  const { remaining, covered } = subtractPantry(kept, pantry, utcMidnight());
  const incoming = toIncoming(remaining);

  return prisma.$transaction(async (tx) => {
    const listId = await ensureActiveListId(tx, userId);
    const rows = await tx.shoppingListItem.findMany({ where: { shoppingListId: listId } });
    const plan = mergeIntoItems(
      rows.map((r) => ({
        id: r.id,
        itemName: r.itemName,
        unit: r.unit,
        quantity: r.quantity.toNumber(),
        isChecked: r.isChecked,
      })),
      incoming,
    );

    if (rows.length + plan.inserts.length > MAX_ITEMS_PER_LIST) throw listFull();

    await bulkUpdateItems(tx, listId, plan.updates);
    if (plan.inserts.length > 0) {
      await tx.shoppingListItem.createMany({
        data: plan.inserts.map((i) => ({
          shoppingListId: listId,
          itemName: i.itemName,
          quantity: new Decimal(i.quantity),
          unit: i.unit,
          category: i.category,
        })),
      });
    }
    if (rows.length === 0) {
      await tx.shoppingList.update({ where: { id: listId }, data: { mealPlanId } });
    }

    return {
      list: await loadListDto(tx, listId),
      added: plan.inserts.length,
      merged: plan.updates.length,
      covered,
      skippedStaples: skipped,
      pantryCapped,
    };
  }, GENERATE_TRANSACTION_OPTIONS);
}
