/**
 * Shopping controller.
 */

import type { Request, Response } from 'express';
import { ShoppingService } from './shopping.service';

const shoppingService = new ShoppingService();

export class ShoppingController {
  async getActiveList(req: Request, res: Response): Promise<void> {
    const userId = (req as any).user.id as string;
    const list = await shoppingService.getActiveList(userId);
    res.status(200).json(list);
  }
}
