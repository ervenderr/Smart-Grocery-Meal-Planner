import { getApiErrorCode } from '@/lib/api/errors';
import type { FoodAttribution, FoodProduct } from '@/lib/api/food';
import { isOfflineError } from '@/lib/api/offline-error';
import { normalizeBarcode } from '@/lib/scan/barcode';
import type { PantryItem, UpdatePantryItemData } from '@/types/pantry.types';
import type { NewOp } from '../outbox/op-types';
import { buildPantryUpdate } from '../ops/pantry-ops';
import type { BarcodeCache } from './barcode-cache';
import type { PendingScan, PendingScans } from './pending-scan';

const isBlank = (v: string | null | undefined): boolean => v == null || v.trim() === '';

/** Only fields that are empty on the item. Never quantity, never a typed name. */
export function fillBlanksPatch(
  item: PantryItem,
  product: FoodProduct,
  barcode: string
): UpdatePantryItemData {
  return {
    ...(isBlank(item.notes) && product.brand ? { notes: product.brand } : {}),
    ...(item.category === 'other' && product.suggestedCategory !== 'other'
      ? { category: product.suggestedCategory }
      : {}),
    ...(isBlank(item.barcode) ? { barcode: normalizeBarcode(barcode) } : {}),
  };
}

export interface ResolvePendingArgs {
  pending: PendingScans;
  list: PendingScan[];
  cache: BarcodeCache;
  userId: string;
  lookup: (code: string) => Promise<{ product: FoodProduct; attribution: FoodAttribution }>;
  getItem: (id: string) => PantryItem | undefined;
  isCreatePending: (id: string) => boolean;
  enqueue: (op: NewOp) => Promise<unknown>;
}

async function resolveOne(args: ResolvePendingArgs, scan: PendingScan): Promise<'resolved' | 'filled' | 'skipped'> {
  const { pending, cache, userId } = args;
  if (args.isCreatePending(scan.pantryItemId)) return 'skipped';
  const item = args.getItem(scan.pantryItemId);
  if (!item) {
    await pending.markResolved(scan.pantryItemId);
    return 'resolved';
  }
  try {
    const { product, attribution } = await args.lookup(scan.barcode);
    await cache.putFound(userId, normalizeBarcode(scan.barcode), product, attribution);
    const patch = fillBlanksPatch(item, product, scan.barcode);
    const ops = buildPantryUpdate(item, patch);
    for (const op of ops) await args.enqueue(op);
    await pending.markResolved(scan.pantryItemId);
    return ops.length > 0 ? 'filled' : 'resolved';
  } catch (error) {
    if (isOfflineError(error)) return 'skipped';
    if (getApiErrorCode(error) === 'LOOKUP_NOT_FOUND') {
      await cache.putNotFound(userId, normalizeBarcode(scan.barcode));
      await pending.markResolved(scan.pantryItemId);
      return 'resolved';
    }
    await pending.bumpAttempts(scan.pantryItemId);
    return 'skipped';
  }
}

export async function resolvePendingScans(
  args: ResolvePendingArgs
): Promise<{ resolved: number; filled: number }> {
  let resolved = 0;
  let filled = 0;
  for (const scan of args.list) {
    const outcome = await resolveOne(args, scan);
    if (outcome !== 'skipped') resolved += 1;
    if (outcome === 'filled') filled += 1;
  }
  return { resolved, filled };
}
