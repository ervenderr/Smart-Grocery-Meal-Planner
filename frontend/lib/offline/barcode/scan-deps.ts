import type { FoodAttribution, FoodProduct } from '@/lib/api/food';
import { OfflineError } from '@/lib/api/offline-error';
import { normalizeBarcode } from '@/lib/scan/barcode';
import type { ResolveDeps } from '@/lib/scan/resolve-barcode';
import { getApiErrorCode } from '@/lib/api/errors';
import type { PantryItem } from '@/types/pantry.types';
import type { BarcodeCache } from './barcode-cache';

type LookupResult = { product: FoodProduct; attribution: FoodAttribution };

export interface ScanDepsArgs {
  userId: string;
  getPantryItems: () => PantryItem[];
  cache: BarcodeCache;
  isOnline: () => boolean;
  onlineLookup: (code: string) => Promise<LookupResult>;
}

const NOT_FOUND_CODE = 'LOOKUP_NOT_FOUND';
const notFoundError = () => ({ response: { data: { code: NOT_FOUND_CODE } } });

/** findOwn and lookup that work from local data when offline and fill the cache when online. */
export function createScanDeps(args: ScanDepsArgs): ResolveDeps {
  const { userId, cache } = args;

  const findOwn = async (code: string): Promise<PantryItem | null> => {
    const wanted = normalizeBarcode(code);
    return (
      args.getPantryItems().find((i) => i.barcode && normalizeBarcode(i.barcode) === wanted) ?? null
    );
  };

  const lookup = async (code: string): Promise<LookupResult> => {
    const key = normalizeBarcode(code);
    const hit = await cache.get(userId, key);
    if (hit?.found) return { product: hit.product, attribution: hit.attribution };
    if (hit && !hit.found) throw notFoundError();
    if (!args.isOnline()) throw new OfflineError();
    try {
      const result = await args.onlineLookup(code);
      await cache.putFound(userId, key, result.product, result.attribution);
      return result;
    } catch (error) {
      if (getApiErrorCode(error) === NOT_FOUND_CODE) await cache.putNotFound(userId, key);
      throw error;
    }
  };

  return { findOwn, lookup };
}
