/**
 * Shopping service.
 */

import { prisma } from '../../config/database.config';
import type { ShoppingListDto } from '../../types/shopping.types';
import { ensureActiveListId, loadListDto } from './shopping.repository';

export class ShoppingService {
  /** Returns the user's active list, creating it on first use. */
  async getActiveList(userId: string): Promise<ShoppingListDto> {
    return prisma.$transaction(async (tx) =>
      loadListDto(tx, await ensureActiveListId(tx, userId)),
    );
  }
}
