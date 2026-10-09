/**
 * Shopping controller.
 */

import type { Request, Response } from 'express';
import { matchedData } from 'express-validator';
import type {
  CreateShoppingItemInput,
  UpdateShoppingItemInput,
} from '../../types/shopping.types';
import type { CarryOverMode } from '../../types/shopping.types';
import { logger } from '../../config/logger.config';
import { finishShopping, getHistory } from './shopping-finish.service';
import { applyPantryMerge } from './shopping-pantry.service';
import { HISTORY_PAGE_LIMIT_DEFAULT } from './shopping.constants';
import { generateFromMealPlan } from './shopping-generate.service';
import { ShoppingService } from './shopping.service';

const shoppingService = new ShoppingService();

const userIdOf = (req: Request): string => (req as any).user.id as string;

const NULLABLE_FIELDS = ['costEstimateCents', 'actualCostCents', 'notes'] as const;

/**
 * Validated body fields only. Optional-skipped explicit nulls (nullable
 * fields) and a falsy category are carried through as null (a clear).
 */
const itemInput = (req: Request): UpdateShoppingItemInput => {
  const data = matchedData(req, { locations: ['body'], includeOptionals: false });
  const body = req.body as Record<string, unknown>;
  const nulls = NULLABLE_FIELDS.filter((f) => body[f] === null);
  const clearsCategory =
    Object.prototype.hasOwnProperty.call(body, 'category') && !body.category;
  return {
    ...data,
    ...Object.fromEntries(nulls.map((f) => [f, null])),
    ...(clearsCategory && { category: null }),
  };
};

export class ShoppingController {
  async getActiveList(req: Request, res: Response): Promise<void> {
    const list = await shoppingService.getActiveList(userIdOf(req));
    res.status(200).json(list);
  }

  async addItem(req: Request, res: Response): Promise<void> {
    const item = await shoppingService.addItem(
      userIdOf(req),
      itemInput(req) as CreateShoppingItemInput,
    );
    res.status(201).json(item);
  }

  async updateItem(req: Request, res: Response): Promise<void> {
    const item = await shoppingService.updateItem(
      userIdOf(req),
      req.params.itemId as string,
      itemInput(req),
    );
    res.status(200).json(item);
  }

  async deleteItem(req: Request, res: Response): Promise<void> {
    const item = await shoppingService.deleteItem(userIdOf(req), req.params.itemId as string);
    res.status(200).json(item);
  }

  async generate(req: Request, res: Response): Promise<void> {
    const { mealPlanId } = matchedData(req, { locations: ['body'] }) as { mealPlanId: string };
    const result = await generateFromMealPlan(userIdOf(req), mealPlanId);
    res.status(200).json(result);
  }

  async finish(req: Request, res: Response): Promise<void> {
    const { carryOver, receiptDate, addToPantry } = matchedData(req, {
      locations: ['body'],
    }) as {
      carryOver?: CarryOverMode;
      receiptDate?: string;
      addToPantry?: boolean;
    };
    const userId = userIdOf(req);
    const outcome = await finishShopping(userId, carryOver, receiptDate);
    if (addToPantry !== true) {
      res.status(200).json(outcome.result);
      return;
    }
    // The finish transaction has committed; a pantry failure must never undo it.
    try {
      const { added, merged } = await applyPantryMerge(
        userId,
        outcome.checkedItems,
        outcome.receiptDate,
      );
      res.status(200).json({ ...outcome.result, pantry: { added, merged, failed: false } });
    } catch (error) {
      logger.error('Bought-it pantry merge failed', {
        userId,
        itemCount: outcome.checkedItems.length,
        error: error instanceof Error ? error.message : String(error),
      });
      res
        .status(200)
        .json({ ...outcome.result, pantry: { added: 0, merged: 0, failed: true } });
    }
  }

  async history(req: Request, res: Response): Promise<void> {
    const { page = 1, limit = HISTORY_PAGE_LIMIT_DEFAULT } = matchedData(req, {
      locations: ['query'],
    }) as { page?: number; limit?: number };
    res.status(200).json(await getHistory(userIdOf(req), page, limit));
  }
}
