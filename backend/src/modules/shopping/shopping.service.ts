/**
 * Shopping service.
 */

import { replayMatchesOriginal } from '@/modules/sync/client-id-replay';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../config/database.config';
import { AppError } from '../../middleware/errorHandler';
import type {
  AddItemResult,
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

const toQuantity = (q: number): Decimal => {
  if (typeof q !== 'number' || !Number.isFinite(q)) {
    throw new AppError('Quantity must be a finite number', 400, true, {
      code: SHOPPING_ERROR_CODES.VALIDATION_ERROR,
    });
  }
  return new Decimal(Math.round(q * 100) / 100);
};

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

  async addItem(userId: string, input: CreateShoppingItemInput): Promise<AddItemResult> {
    return prisma.$transaction(async (tx) => {
      const listId = await ensureActiveListId(tx, userId);
      if (input.id) {
        // Pre-check under the list row lock (serialises same-user retries).
        // Do NOT catch P2002 here: in Postgres a unique violation aborts the
        // whole interactive transaction, so the fallback read would fail too.
        // Note: a replay whose original row was carried to a new list after
        // finish returns the old row (Phase 11 outbox concern).
        const existing = await tx.shoppingListItem.findUnique({
          where: { id: input.id },
          include: { shoppingList: { select: { userId: true } } },
        });
        if (existing) {
          if (existing.shoppingList.userId !== userId) {
            throw new AppError('That item id is already in use.', 409, true, {
              code: SHOPPING_ERROR_CODES.CLIENT_ID_CONFLICT,
            });
          }
          const matches = replayMatchesOriginal(
            {
              name: existing.itemName,
              quantity: existing.quantity,
              unit: existing.unit,
              createdAt: existing.createdAt,
              updatedAt: existing.updatedAt,
            },
            { name: input.itemName, quantity: input.quantity, unit: input.unit },
          );
          if (!matches) {
            throw new AppError('That item id was already used with different content.', 409, true, {
              code: SHOPPING_ERROR_CODES.CLIENT_ID_CONFLICT,
            });
          }
          return { item: toItemDto(existing), created: false };
        }
      }
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
          ...(input.id && { id: input.id }),
          itemName: input.itemName,
          shoppingListId: listId,
        },
      });
      return { item: toItemDto(created), created: true };
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
