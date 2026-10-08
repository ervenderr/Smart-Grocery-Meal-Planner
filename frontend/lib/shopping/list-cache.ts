import type {
  CreateShoppingItemInput,
  ShoppingItem,
  ShoppingList,
  UpdateShoppingItemInput,
} from '@/types/shopping.types';

/**
 * Pure, immutable helpers for optimistic React Query cache updates.
 * All accept `undefined` (empty cache) and return `undefined` for the list.
 */

export function applyItemPatch(
  list: ShoppingList | undefined,
  itemId: string,
  patch: UpdateShoppingItemInput
): ShoppingList | undefined {
  if (!list) return undefined;
  return {
    ...list,
    items: list.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
  };
}

export function removeItem(
  list: ShoppingList | undefined,
  itemId: string
): { list: ShoppingList | undefined; removed: ShoppingItem | null } {
  if (!list) return { list: undefined, removed: null };
  const removed = list.items.find((item) => item.id === itemId) ?? null;
  return {
    list: { ...list, items: list.items.filter((item) => item.id !== itemId) },
    removed,
  };
}

export function upsertItem(
  list: ShoppingList | undefined,
  item: ShoppingItem
): ShoppingList | undefined {
  if (!list) return undefined;
  const exists = list.items.some((existing) => existing.id === item.id);
  return {
    ...list,
    items: exists
      ? list.items.map((existing) => (existing.id === item.id ? item : existing))
      : [...list.items, item],
  };
}

/** Build a POST body from an item, used for undo-by-re-POST of a deleted item. */
export function toCreateInput(item: ShoppingItem): CreateShoppingItemInput {
  return {
    itemName: item.itemName,
    quantity: item.quantity,
    unit: item.unit,
    category: item.category,
    costEstimateCents: item.costEstimateCents,
    actualCostCents: item.actualCostCents,
    isChecked: item.isChecked,
    notes: item.notes,
  };
}
