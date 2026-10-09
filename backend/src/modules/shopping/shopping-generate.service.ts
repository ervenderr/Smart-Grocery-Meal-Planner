/**
 * Generate a saved shopping list from a meal plan (merge into the active list).
 * Pipeline: aggregate (exact) -> drop staples -> subtract pantry -> subtract
 * what is already unchecked on the list -> merge. All reads happen inside the
 * transaction after the list row lock.
 */

import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../config/database.config';
import { logger } from '../../config/logger.config';
import { AppError } from '../../middleware/errorHandler';
import type { GenerateFromMealPlanResult } from '../../types/shopping.types';
import { IngredientGroup, displayOf } from '../intelligence/merge-groups';
import { subtractListStock } from '../intelligence/list-subtract';
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

/** Reads below run on the transaction client, AFTER the list row lock is held. */
const loadPlanGroups = async (tx: Prisma.TransactionClient, userId: string, mealPlanId: string) => {
  const plan = await tx.mealPlan.findFirst({
    where: { id: mealPlanId, userId, deletedAt: null },
    include: { mealPlanItems: { include: { recipe: true } } },
  });
  if (!plan) throw planNotFound();
  // Usable = at least one positive-quantity line with a real name (WR-07).
  const { groups } = aggregateGroups(plan.mealPlanItems);
  if (groups.length === 0) throw planEmpty();
  return groups;
};

const loadUserContext = async (tx: Prisma.TransactionClient, userId: string) => {
  const pref = await tx.userPreference.findUnique({ where: { userId }, select: { stapleNames: true } });
  const pantry = await tx.pantryItem.findMany({
    where: { userId, deletedAt: null, quantity: { gt: 0 } },
    select: { ingredientName: true, quantity: true, unit: true, expiryDate: true },
    orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }],
    take: PANTRY_COMPARE_CAP,
  });
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
  return prisma.$transaction(async (tx) => {
    // Lock first: plan, pantry and list are all read after the list row lock
    // so a concurrent generate cannot compute from stale data.
    const listId = await ensureActiveListId(tx, userId);
    const groups = await loadPlanGroups(tx, userId, mealPlanId);
    const { staples, pantry, pantryCapped } = await loadUserContext(tx, userId);
    const rows = await tx.shoppingListItem.findMany({ where: { shoppingListId: listId } });

    const { kept, skipped } = filterStaples(groups, staples);
    const pantryResult = subtractPantry(kept, pantry, utcMidnight());
    const listResult = subtractListStock(
      pantryResult.remaining,
      rows.map((r) => ({
        itemName: r.itemName,
        quantity: r.quantity,
        unit: r.unit,
        isChecked: r.isChecked,
      })),
    );
    const covered = [...pantryResult.covered, ...listResult.covered];
    const incoming = toIncoming(listResult.remaining);

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
