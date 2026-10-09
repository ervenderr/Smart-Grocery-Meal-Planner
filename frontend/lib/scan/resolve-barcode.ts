import type { FoodAttribution, FoodProduct } from '@/lib/api/food';
import { getApiErrorCode } from '@/lib/api/errors';
import type { PantryItem } from '@/types/pantry.types';

export type BarcodeResolution =
  | { kind: 'own'; barcode: string; item: PantryItem }
  | { kind: 'found'; barcode: string; product: FoodProduct; attribution: FoodAttribution }
  | { kind: 'unknown'; barcode: string }
  | { kind: 'failed'; barcode: string };

interface ResolveDeps {
  findOwn: (barcode: string) => Promise<PantryItem | null>;
  lookup: (barcode: string) => Promise<{ product: FoodProduct; attribution: FoodAttribution }>;
}

/** Own pantry first, then Open Food Facts. Never throws. */
export async function resolveBarcode(
  code: string,
  deps: ResolveDeps
): Promise<BarcodeResolution> {
  try {
    const item = await deps.findOwn(code);
    if (item) return { kind: 'own', barcode: code, item };
  } catch {
    // A failed own-pantry check must not block the product lookup.
  }

  try {
    const { product, attribution } = await deps.lookup(code);
    if (!product.name || product.name.trim().length === 0) {
      return { kind: 'unknown', barcode: code };
    }
    return { kind: 'found', barcode: code, product, attribution };
  } catch (error) {
    if (getApiErrorCode(error) === 'LOOKUP_NOT_FOUND') {
      return { kind: 'unknown', barcode: code };
    }
    return { kind: 'failed', barcode: code };
  }
}
