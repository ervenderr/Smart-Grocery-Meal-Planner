import type { PantryItem } from '@/types/pantry.types';

export type PantryListFilters = { category?: string; search?: string };

/** In-memory pantry filter; returns a new array and never mutates its input. */
export function filterPantryItems(
  items: readonly PantryItem[],
  filters: PantryListFilters,
): PantryItem[] {
  const term = filters.search?.trim().toLowerCase();
  return items.filter((item) => {
    if (filters.category && item.category !== filters.category) return false;
    if (!term) return true;
    const brand = (item as { brand?: string | null }).brand;
    return (
      item.ingredientName.toLowerCase().includes(term) ||
      (typeof brand === 'string' && brand.toLowerCase().includes(term))
    );
  });
}
