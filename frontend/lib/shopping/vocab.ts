/** Shared shopping vocabulary, aligned to backend/src/types/pantry.types.ts. */

export type ShoppingCategory =
  | 'protein'
  | 'vegetable'
  | 'fruit'
  | 'dairy'
  | 'grains'
  | 'spices'
  | 'canned'
  | 'frozen'
  | 'beverages'
  | 'condiments'
  | 'other';

export type ShoppingUnit =
  | 'kg'
  | 'grams'
  | 'lbs'
  | 'oz'
  | 'liters'
  | 'ml'
  | 'cups'
  | 'tbsp'
  | 'tsp'
  | 'fl_oz'
  | 'pieces'
  | 'items';

/** Display order; "Other" is always last. */
export const SHOPPING_CATEGORIES: readonly { readonly value: ShoppingCategory; readonly label: string }[] = [
  { value: 'protein', label: 'Protein' },
  { value: 'vegetable', label: 'Vegetables' },
  { value: 'fruit', label: 'Fruits' },
  { value: 'dairy', label: 'Dairy' },
  { value: 'grains', label: 'Grains' },
  { value: 'spices', label: 'Spices' },
  { value: 'canned', label: 'Canned Goods' },
  { value: 'frozen', label: 'Frozen' },
  { value: 'beverages', label: 'Beverages' },
  { value: 'condiments', label: 'Condiments' },
  { value: 'other', label: 'Other' },
];

export const CATEGORY_ORDER: readonly ShoppingCategory[] = SHOPPING_CATEGORIES.map((c) => c.value);

export const SHOPPING_UNITS: readonly { readonly value: ShoppingUnit; readonly label: string }[] = [
  { value: 'kg', label: 'Kilogram (kg)' },
  { value: 'grams', label: 'Grams (g)' },
  { value: 'lbs', label: 'Pounds (lbs)' },
  { value: 'oz', label: 'Ounces (oz)' },
  { value: 'liters', label: 'Liters (L)' },
  { value: 'ml', label: 'Milliliters (ml)' },
  { value: 'cups', label: 'Cups' },
  { value: 'tbsp', label: 'Tablespoons' },
  { value: 'tsp', label: 'Teaspoons' },
  { value: 'fl_oz', label: 'Fluid Ounces' },
  { value: 'pieces', label: 'Pieces' },
  { value: 'items', label: 'Items' },
];

export const DEFAULT_UNIT: ShoppingUnit = 'pieces';
export const DEFAULT_QUANTITY = 1;

// Limits mirror backend shopping.constants.ts
export const MAX_ITEMS_PER_LIST = 300;
export const MAX_ITEM_NAME_LENGTH = 100;
export const MAX_NOTES_LENGTH = 500;
export const MIN_QUANTITY = 0.01;
export const MAX_QUANTITY = 99999;
export const MAX_ITEM_CENTS = 200_000_000;
export const MAX_UNIT_LENGTH = 20;

const CATEGORY_SET: ReadonlySet<string> = new Set(CATEGORY_ORDER);
const UNIT_LABELS: ReadonlyMap<string, string> = new Map(SHOPPING_UNITS.map((u) => [u.value, u.label]));
const CATEGORY_LABELS: ReadonlyMap<string, string> = new Map(
  SHOPPING_CATEGORIES.map((c) => [c.value, c.label])
);

export function normalizeCategory(value: string | null | undefined): ShoppingCategory {
  const key = (value ?? '').trim().toLowerCase();
  return CATEGORY_SET.has(key) ? (key as ShoppingCategory) : 'other';
}

export function isShoppingUnit(value: string): value is ShoppingUnit {
  return UNIT_LABELS.has(value);
}

export function categoryLabel(value: string | null | undefined): string {
  return CATEGORY_LABELS.get(normalizeCategory(value)) ?? 'Other';
}

/** Enum units get their label; free-text units (generated/undone items) render as-is. */
export function unitLabel(value: string): string {
  return UNIT_LABELS.get(value) ?? value;
}
