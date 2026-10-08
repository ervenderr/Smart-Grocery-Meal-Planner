import { CATEGORY_ORDER, categoryLabel, normalizeCategory, type ShoppingCategory } from './vocab';

export interface GroupableItem {
  id: string;
  itemName: string;
  category: string | null;
  isChecked: boolean;
  createdAt: string;
}

export interface CategoryGroup<T> {
  category: ShoppingCategory;
  label: string;
  items: readonly T[];
  uncheckedCount: number;
}

function compareItems(a: GroupableItem, b: GroupableItem): number {
  if (a.isChecked !== b.isChecked) return a.isChecked ? 1 : -1;
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  return a.itemName.localeCompare(b.itemName);
}

/** Group by category in fixed order; checked items sink. Never mutates input. */
export function groupItems<T extends GroupableItem>(items: readonly T[]): CategoryGroup<T>[] {
  return CATEGORY_ORDER.map((category) => {
    const inGroup = items.filter((i) => normalizeCategory(i.category) === category);
    const sorted = [...inGroup].sort(compareItems);
    return {
      category,
      label: categoryLabel(category),
      items: sorted,
      uncheckedCount: sorted.filter((i) => !i.isChecked).length,
    };
  }).filter((g) => g.items.length > 0);
}
