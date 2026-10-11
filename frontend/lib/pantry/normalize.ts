import type { PantryItem } from '@/types/pantry.types';

/** The API returns Decimal quantities as strings; the UI works in numbers. */
export const normalizePantryItem = (item: PantryItem): PantryItem => ({
  ...item,
  quantity: Number(item.quantity),
});
