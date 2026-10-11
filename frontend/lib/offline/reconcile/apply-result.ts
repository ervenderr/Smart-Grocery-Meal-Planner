import type { PantryItem } from '@/types/pantry.types';
import type { ShoppingItem, ShoppingList } from '@/types/shopping.types';
import { normalizePantryItem } from '@/lib/pantry/normalize';
import { removeItem, upsertItem } from '@/lib/shopping/list-cache';
import type { OutboxOp } from '../outbox/op-types';
import { SHOPPING_ACTIVE_KEY } from '../cache/cache-keys';
import { pantryWrites, shoppingWrite, type CacheWrites } from './cache-writes';

export type { CacheWrites } from './cache-writes';

const NONE: CacheWrites = [];

/** Accepts the item directly or wrapped as { item } / { data }; must carry the op's entity id. */
function extractItem(result: unknown, id: string): Record<string, unknown> | null {
  if (!result || typeof result !== 'object') return null;
  const r = result as Record<string, unknown>;
  const inner = [r, r.item, r.data].find(
    (c): c is Record<string, unknown> => !!c && typeof c === 'object' && (c as { id?: unknown }).id === id,
  );
  return inner ?? null;
}

/** Patches the cache with the authoritative server row after an op was applied. */
export function applyResult(op: OutboxOp, result: unknown): CacheWrites {
  switch (op.kind) {
    case 'shopping.item.create':
    case 'shopping.item.update': {
      const item = extractItem(result, op.entityId);
      if (!item) return NONE;
      return [shoppingWrite((list) => upsertItem(list, item as unknown as ShoppingItem))];
    }
    case 'shopping.item.delete':
      return [shoppingWrite((list) => removeItem(list, op.entityId).list)];
    case 'pantry.create':
    case 'pantry.update':
    case 'pantry.adjust': {
      const raw = extractItem(result, op.entityId);
      if (!raw) return NONE;
      const server = normalizePantryItem(raw as unknown as PantryItem);
      if (!Number.isFinite(server.quantity)) return NONE;
      return pantryWrites((items) => items.map((i) => (i.id === server.id ? server : i)));
    }
    case 'pantry.delete':
      return pantryWrites((items) => items.filter((i) => i.id !== op.entityId));
    case 'shopping.finish': {
      const list = (result as { list?: unknown } | null)?.list;
      if (!list || typeof list !== 'object' || !Array.isArray((list as ShoppingList).items)) return NONE;
      return [{ key: SHOPPING_ACTIVE_KEY, update: () => list }];
    }
    default:
      return NONE;
  }
}
