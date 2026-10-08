/**
 * Generate a saved shopping list from a meal plan (merge into the active list).
 */

import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../config/database.config';
import { AppError } from '../../middleware/errorHandler';
import type { GenerateFromMealPlanResult } from '../../types/shopping.types';
import { MealPlanService } from '../mealplan/mealplan.service';
import { MAX_ITEMS_PER_LIST, SHOPPING_ERROR_CODES } from './shopping.constants';
import { mergeIntoItems } from './shopping.merge';
import { ensureActiveListId, loadListDto } from './shopping.repository';

const mealPlanService = new MealPlanService();

const planNotFound = (): AppError =>
  new AppError('Meal plan not found', 404, true, {
    code: SHOPPING_ERROR_CODES.MEAL_PLAN_NOT_FOUND,
  });

const aggregatePlan = async (userId: string, mealPlanId: string) => {
  try {
    return await mealPlanService.generateShoppingList(userId, mealPlanId);
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 404) throw planNotFound();
    throw error;
  }
};

export async function generateFromMealPlan(
  userId: string,
  mealPlanId: string,
): Promise<GenerateFromMealPlanResult> {
  const aggregated = await aggregatePlan(userId, mealPlanId);
  const incoming = aggregated.items.map((i) => ({
    itemName: i.ingredientName,
    quantity: i.quantity,
    unit: i.unit,
  }));
  if (incoming.length === 0) {
    throw new AppError('This meal plan has no ingredients to add', 400, true, {
      code: SHOPPING_ERROR_CODES.MEAL_PLAN_EMPTY,
    });
  }

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

    if (rows.length + plan.inserts.length > MAX_ITEMS_PER_LIST) {
      throw new AppError(
        `Your list is full (${MAX_ITEMS_PER_LIST} items maximum)`,
        400,
        true,
        { code: SHOPPING_ERROR_CODES.SHOPPING_LIST_FULL },
      );
    }

    for (const u of plan.updates) {
      await tx.shoppingListItem.update({
        where: { id: u.id },
        data: { quantity: new Decimal(u.quantity) },
      });
    }
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
    };
  });
}
