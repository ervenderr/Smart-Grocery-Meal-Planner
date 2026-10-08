/**
 * Shopping controller.
 */

import type { Request, Response } from 'express';
import { matchedData } from 'express-validator';
import type {
  CreateShoppingItemInput,
  UpdateShoppingItemInput,
} from '../../types/shopping.types';
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
}
