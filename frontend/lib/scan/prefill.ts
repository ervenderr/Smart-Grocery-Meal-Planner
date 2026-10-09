import type { FoodProduct } from '@/lib/api/food';
import type { CreatePantryItemData, PantryItem, PantryItemUnit } from '@/types/pantry.types';

const QUANTITY_PATTERN = /^(\d+(?:[.,]\d+)?)\s*([a-zA-Z]+)$/;

const UNIT_MAP: Record<string, PantryItemUnit> = {
  g: 'grams',
  gr: 'grams',
  gram: 'grams',
  grams: 'grams',
  kg: 'kg',
  ml: 'ml',
  l: 'liters',
  lt: 'liters',
  liter: 'liters',
  liters: 'liters',
  litre: 'liters',
  litres: 'liters',
  pc: 'pieces',
  pcs: 'pieces',
  piece: 'pieces',
  pieces: 'pieces',
  oz: 'oz',
  lb: 'lbs',
  lbs: 'lbs',
};

/** Parses OFF quantity text like "500 g". Multi-packs and free text return null. */
export function parseProductQuantity(
  text: string | null
): { quantity: number; unit: PantryItemUnit } | null {
  if (!text) return null;
  const match = QUANTITY_PATTERN.exec(text.trim());
  if (!match) return null;
  const unit = UNIT_MAP[match[2].toLowerCase()];
  const quantity = Number(match[1].replace(',', '.'));
  if (!unit || !Number.isFinite(quantity) || quantity <= 0) return null;
  return { quantity, unit };
}

export function prefillFromProduct(
  product: FoodProduct,
  barcode: string
): Partial<CreatePantryItemData> {
  const parsed = parseProductQuantity(product.quantity);
  return {
    ingredientName: product.name,
    ...(product.brand ? { notes: product.brand } : {}),
    category: product.suggestedCategory,
    quantity: parsed?.quantity ?? 1,
    unit: parsed?.unit ?? 'pieces',
    barcode,
  };
}

export function prefillFromOwnItem(item: PantryItem): Partial<CreatePantryItemData> {
  return {
    ingredientName: item.ingredientName,
    category: item.category,
    unit: item.unit,
    quantity: 1,
    ...(item.barcode ? { barcode: item.barcode } : {}),
  };
}
