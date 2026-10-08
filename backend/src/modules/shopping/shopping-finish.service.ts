/**
 * Finish a shopping trip (history row + carry-over) and read trip history.
 */

import { prisma } from '../../config/database.config';
import { AppError } from '../../middleware/errorHandler';
import type {
  CarryOverMode,
  FinishShoppingResult,
  ShoppingHistoryPage,
} from '../../types/shopping.types';
import { SHOPPING_ERROR_CODES } from './shopping.constants';
import { toHistoryDto } from './shopping.dto';
import {
  ensureActiveListId,
  findActiveListIdForUpdate,
  loadListDto,
} from './shopping.repository';
import { computeHistoryTotals } from './shopping.totals';

const DAY_MS = 24 * 60 * 60 * 1000;

const utcMidnight = (d: Date): number =>
  Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

/** True when a YYYY-MM-DD date lies within UTC today -1 day .. +1 day (covers every timezone). */
export const withinOneDayOfUtcToday = (value: string, now: Date = new Date()): boolean => {
  const ms = Date.parse(`${value}T00:00:00.000Z`);
  if (Number.isNaN(ms)) return false;
  return Math.abs(ms - utcMidnight(now)) <= DAY_MS;
};

const emptyError = (): AppError =>
  new AppError('Add items to your list before finishing a trip.', 400, true, {
    code: SHOPPING_ERROR_CODES.SHOPPING_LIST_EMPTY,
  });

export async function finishShopping(
  userId: string,
  carryOver: CarryOverMode = 'carry',
  receiptDate?: string,
): Promise<FinishShoppingResult> {
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
      data: { isCompleted: true, completedAt: new Date(), totalCostCents: totals.totalCents },
    });
    const date = receiptDate
      ? new Date(`${receiptDate}T00:00:00.000Z`)
      : new Date(utcMidnight(new Date()));
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

    return {
      history: toHistoryDto(history, totals, list.name),
      list: await loadListDto(tx, newListId),
    };
  });
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
