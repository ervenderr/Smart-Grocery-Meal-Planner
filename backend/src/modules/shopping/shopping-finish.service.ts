/**
 * Finish a shopping trip (history row + carry-over) and read trip history.
 */

import { prisma } from '../../config/database.config';
import { AppError } from '../../middleware/errorHandler';
import type {
  FinishShoppingOptions,
  FinishShoppingOutcome,
  ShoppingHistoryPage,
} from '../../types/shopping.types';
import { SHOPPING_ERROR_CODES } from './shopping.constants';
import { toHistoryDto } from './shopping.dto';
import { applyPantryMergeInTx } from './shopping-pantry.service';
import { clampOccurredAt, utcDateOf } from './shopping.receipt-window';
import {
  ensureActiveListId,
  findActiveListIdForUpdate,
  loadListDto,
} from './shopping.repository';
import { computeHistoryTotals } from './shopping.totals';

const emptyError = (): AppError =>
  new AppError('Add items to your list before finishing a trip.', 400, true, {
    code: SHOPPING_ERROR_CODES.SHOPPING_LIST_EMPTY,
  });

const FINISH_TX_TIMEOUT_MS = 15000;

export async function finishShopping(
  userId: string,
  options: FinishShoppingOptions = {},
): Promise<FinishShoppingOutcome> {
  const { carryOver = 'carry', receiptDate, occurredAt, addToPantry } = options;
  const occurred = clampOccurredAt(occurredAt);
  // Lock order: shopping list row lock (findActiveListIdForUpdate) first, then
  // lockUserPantry inside the merge. Cook and adjust only take the pantry lock,
  // so this order cannot deadlock.
  return prisma.$transaction(async (tx) => {
    const listId = await findActiveListIdForUpdate(tx, userId);
    if (!listId) throw emptyError();

    const items = await tx.shoppingListItem.findMany({ where: { shoppingListId: listId } });
    if (items.length === 0) throw emptyError();

    const totals = computeHistoryTotals(items);
    if (totals.checkedCount === 0) {
      throw new AppError('Check off at least one item before finishing this trip.', 400, true, {
        code: SHOPPING_ERROR_CODES.SHOPPING_LIST_NOTHING_CHECKED,
      });
    }

    const list = await tx.shoppingList.update({
      where: { id: listId },
      data: { isCompleted: true, completedAt: occurred, totalCostCents: totals.totalCents },
    });
    const date = receiptDate
      ? new Date(`${receiptDate}T00:00:00.000Z`)
      : utcDateOf(occurred);
    const history = await tx.shoppingHistory.create({
      data: {
        userId,
        shoppingListId: listId,
        receiptDate: date,
        // totalPhpCents holds minor units of the user's currency (legacy column name).
        totalPhpCents: totals.totalCents,
      },
    });

    const newListId = await ensureActiveListId(tx, userId);
    if (carryOver === 'carry') {
      const unchecked = items.filter((i) => !i.isChecked);
      if (unchecked.length > 0) {
        await tx.shoppingListItem.createMany({
          data: unchecked.map((i) => ({
            shoppingListId: newListId,
            itemName: i.itemName,
            quantity: i.quantity,
            unit: i.unit,
            category: i.category,
            costEstimateCents: i.costEstimateCents,
            notes: i.notes,
            isChecked: false,
            actualCostCents: null,
          })),
        });
      }
    }

    const checkedItems = items
      .filter((i) => i.isChecked)
      .map((i) => ({
        itemName: i.itemName,
        quantity: i.quantity,
        unit: i.unit,
        category: i.category,
        actualCostCents: i.actualCostCents,
        costEstimateCents: i.costEstimateCents,
      }));

    const merge =
      addToPantry === true
        ? await applyPantryMergeInTx(tx, userId, checkedItems, date)
        : undefined;

    return {
      result: {
        history: toHistoryDto(history, totals, list.name),
        list: await loadListDto(tx, newListId),
      },
      checkedItems,
      receiptDate: date,
      ...(merge && { pantry: { ...merge, failed: false as const } }),
    };
  }, { timeout: FINISH_TX_TIMEOUT_MS });
}

export async function getHistory(
  userId: string,
  page: number,
  limit: number,
): Promise<ShoppingHistoryPage> {
  const [rows, total] = await Promise.all([
    prisma.shoppingHistory.findMany({
      where: { userId },
      orderBy: [{ receiptDate: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        shoppingList: {
          select: {
            name: true,
            shoppingListItems: {
              select: { isChecked: true, actualCostCents: true, costEstimateCents: true },
            },
          },
        },
      },
    }),
    prisma.shoppingHistory.count({ where: { userId } }),
  ]);

  return {
    items: rows.map((row) =>
      toHistoryDto(
        row,
        computeHistoryTotals(row.shoppingList?.shoppingListItems ?? []),
        row.shoppingList?.name ?? null,
      ),
    ),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}
