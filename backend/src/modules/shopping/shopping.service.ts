/**
 * Shopping service.
 */

import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../config/database.config';
import { AppError } from '../../middleware/errorHandler';
import type {
  CreateShoppingItemInput,
  ShoppingItemDto,
  ShoppingListDto,
  UpdateShoppingItemInput,
} from '../../types/shopping.types';
import {
  DEFAULT_CATEGORY,
  DEFAULT_QUANTITY,
  DEFAULT_UNIT,
  MAX_ITEMS_PER_LIST,
  SHOPPING_ERROR_CODES,
} from './shopping.constants';
import { inferCategory } from './shopping.category';
import { toItemDto } from './shopping.dto';
import {
  ensureActiveListId,
  findActiveListIdForUpdate,
  loadListDto,
} from './shopping.repository';

const notFound = (): AppError =>
  new AppError('Shopping item not found', 404, true, {
    code: SHOPPING_ERROR_CODES.SHOPPING_ITEM_NOT_FOUND,
  });

/** Maps a Prisma P2025 (record vanished mid-transaction) to the item 404. */
const mapNotFound = (error: unknown): unknown =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025'
    ? notFound()
    : error;

const toQuantity = (q: number): Decimal => new Decimal(Math.round(q * 100) / 100);

/** Explicit whitelist of the 8 updatable fields (mass-assignment safe). */
const buildItemData = (
  input: UpdateShoppingItemInput,
): Prisma.ShoppingListItemUncheckedUpdateInput => ({
  ...(input.itemName !== undefined && { itemName: input.itemName }),
  ...(input.quantity !== undefined && { quantity: toQuantity(input.quantity) }),
  ...(input.unit !== undefined && { unit: input.unit }),
  ...('category' in input && { category: input.category || DEFAULT_CATEGORY }),
  ...(input.costEstimateCents !== undefined && { costEstimateCents: input.costEstimateCents }),
  ...(input.actualCostCents !== undefined && { actualCostCents: input.actualCostCents }),
  ...(input.isChecked !== undefined && { isChecked: input.isChecked }),
  ...(input.notes !== undefined && { notes: input.notes }),
});

/** Locks the user's active list first, then does the ownership-scoped lookup. */
const findOwnedItemForUpdate = async (
  tx: Prisma.TransactionClient,
  userId: string,
  itemId: string,
) => {
  const listId = await findActiveListIdForUpdate(tx, userId);
  if (!listId) throw notFound();
  const item = await tx.shoppingListItem.findFirst({
    where: {
      id: itemId,
      shoppingListId: listId,
      shoppingList: { userId, isCompleted: false, deletedAt: null },
    },
  });
  if (!item) throw notFound();
  return item;
};

export class ShoppingService {
  /** Returns the user's active list, creating it on first use. */
  async getActiveList(userId: string): Promise<ShoppingListDto> {
    return prisma.$transaction(async (tx) =>
      loadListDto(tx, await ensureActiveListId(tx, userId)),
    );
  }

  async addItem(userId: string, input: CreateShoppingItemInput): Promise<ShoppingItemDto> {
    return prisma.$transaction(async (tx) => {
      const listId = await ensureActiveListId(tx, userId);
      const count = await tx.shoppingListItem.count({ where: { shoppingListId: listId } });
      if (count >= MAX_ITEMS_PER_LIST) {
        throw new AppError(
          `Your list is full (${MAX_ITEMS_PER_LIST} items maximum)`,
          400,
          true,
          { code: SHOPPING_ERROR_CODES.SHOPPING_LIST_FULL },
        );
      }
      const data = buildItemData({
        ...input,
        quantity: input.quantity ?? DEFAULT_QUANTITY,
        unit: input.unit ?? DEFAULT_UNIT,
        category: input.category || inferCategory(input.itemName),
      });
      const created = await tx.shoppingListItem.create({
        data: {
          ...(data as Prisma.ShoppingListItemUncheckedCreateInput),
          itemName: input.itemName,
          shoppingListId: listId,
        },
      });
      return toItemDto(created);
    });
  }

  async updateItem(
    userId: string,
    itemId: string,
    patch: UpdateShoppingItemInput,
  ): Promise<ShoppingItemDto> {
    try {
      return await prisma.$transaction(async (tx) => {
        await findOwnedItemForUpdate(tx, userId, itemId);
        const updated = await tx.shoppingListItem.update({
          where: { id: itemId },
          data: buildItemData(patch),
        });
        return toItemDto(updated);
      });
    } catch (error) {
      throw mapNotFound(error);
    }
  }

  async deleteItem(userId: string, itemId: string): Promise<ShoppingItemDto> {
    try {
      return await prisma.$transaction(async (tx) => {
        const item = await findOwnedItemForUpdate(tx, userId, itemId);
        await tx.shoppingListItem.delete({ where: { id: item.id } });
        return toItemDto(item);
      });
    } catch (error) {
      throw mapNotFound(error);
    }
  }
}
