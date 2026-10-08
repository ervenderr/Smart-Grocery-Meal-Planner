/**
 * Shopping DTO mappers. Always build new objects; never expose Prisma types.
 */

import type { ShoppingList, ShoppingListItem } from '@prisma/client';
import type { ShoppingItemDto, ShoppingListDto } from '../../types/shopping.types';
import { DEFAULT_CATEGORY } from './shopping.constants';

export const toItemDto = (item: ShoppingListItem): ShoppingItemDto => ({
  id: item.id,
  shoppingListId: item.shoppingListId,
  itemName: item.itemName,
  quantity: item.quantity.toNumber(),
  unit: item.unit,
  category: item.category ?? DEFAULT_CATEGORY,
  costEstimateCents: item.costEstimateCents,
  actualCostCents: item.actualCostCents,
  isChecked: item.isChecked,
  notes: item.notes,
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString(),
});

export const toListDto = (
  list: ShoppingList,
  items: readonly ShoppingListItem[],
): ShoppingListDto => {
  const ordered = [...items].sort((a, b) => {
    const delta = a.createdAt.getTime() - b.createdAt.getTime();
    if (delta !== 0) return delta;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return {
    id: list.id,
    name: list.name,
    mealPlanId: list.mealPlanId,
    isCompleted: list.isCompleted,
    createdAt: list.createdAt.toISOString(),
    updatedAt: list.updatedAt.toISOString(),
    items: ordered.map(toItemDto),
  };
};
