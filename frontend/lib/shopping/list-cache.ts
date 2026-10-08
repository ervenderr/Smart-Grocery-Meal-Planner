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

function mergePatch(item: ShoppingItem, patch: UpdateShoppingItemInput): ShoppingItem {
  const { category, ...rest } = patch;
  // The server always stores a category string; a null patch keeps the current one.
  return { ...item, ...rest, category: category ?? item.category };
}

export function applyItemPatch(
  list: ShoppingList | undefined,
  itemId: string,
  patch: UpdateShoppingItemInput
): ShoppingList | undefined {
  if (!list) return undefined;
  return {
    ...list,
    items: list.items.map((item) => (item.id === itemId ? mergePatch(item, patch) : item)),
  };
}

/**
 * Rolls back ONE failed optimistic patch without clobbering newer writes.
 * A field is restored only while it still holds the failed patch's value; if a
 * later mutation changed it, that later (optimistic) value is kept.
 */
export function revertItemPatch(
  list: ShoppingList | undefined,
  previous: ShoppingItem | undefined,
  patch: UpdateShoppingItemInput
): ShoppingList | undefined {
  if (!list || !previous) return list;
  const target = list.items.find((item) => item.id === previous.id);
  if (!target) return list;
  const merged = mergePatch(previous, patch);
  const restored: Record<string, unknown> = {};
  for (const key of Object.keys(patch) as Array<keyof ShoppingItem>) {
    if (target[key] === merged[key]) restored[key] = previous[key];
  }
  if (Object.keys(restored).length === 0) return list;
  return {
    ...list,
    items: list.items.map((item) => (item.id === previous.id ? { ...item, ...restored } : item)),
  };
}

/** Puts a removed item back at its old position (clamped); no-op if it already exists. */
export function restoreItem(
  list: ShoppingList | undefined,
  item: ShoppingItem | null | undefined,
  index: number
): ShoppingList | undefined {
  if (!list || !item) return list;
  if (list.items.some((existing) => existing.id === item.id)) return list;
  const at = Math.max(0, Math.min(index, list.items.length));
  return { ...list, items: [...list.items.slice(0, at), item, ...list.items.slice(at)] };
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
