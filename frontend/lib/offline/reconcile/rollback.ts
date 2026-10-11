import type { PantryItem } from '@/types/pantry.types';
import type { ShoppingItem } from '@/types/shopping.types';
import { normalizePantryItem } from '@/lib/pantry/normalize';
import { applyItemPatch, removeItem, restoreItem } from '@/lib/shopping/list-cache';
import type { OutboxOp } from '../outbox/op-types';
import { mealPlanWrite, pantryWrites, shoppingWrite, type CacheWrites } from './cache-writes';
import { parseInverse, type Inverse } from './inverse';

const round2 = (n: number): number => Math.round(n * 100) / 100;

export type RollbackResult = { writes: CacheWrites; needsRefetch: boolean };

function writesFor(op: OutboxOp, inv: Inverse): CacheWrites {
  const id = op.entityId;
  switch (op.kind) {
    case 'shopping.item.create':
      return [shoppingWrite((l) => removeItem(l, id).list)];
    case 'shopping.item.update':
      return [shoppingWrite((l) => applyItemPatch(l, id, inv.previous as Partial<ShoppingItem>))];
    case 'shopping.item.delete':
      return [shoppingWrite((l) => restoreItem(l, inv.item as ShoppingItem, l.items.length))];
    case 'pantry.create':
      return pantryWrites((items) => items.filter((i) => i.id !== id));
    case 'pantry.adjust': {
      const { delta } = op.payload as { delta: number };
      return pantryWrites((items) =>
        items.map((i) => (i.id === id ? { ...i, quantity: Math.max(0, round2(i.quantity - delta)) } : i)),
      );
    }
    case 'pantry.update':
      return pantryWrites((items) => items.map((i) => (i.id === id ? { ...i, ...(inv.previous as Partial<PantryItem>) } : i)));
    case 'pantry.delete': {
      const item = normalizePantryItem(inv.item as unknown as PantryItem);
      return pantryWrites((items) => (items.some((i) => i.id === id) ? [...items] : [...items, item]));
    }
    case 'cook.apply': {
      const { target } = op.payload as { target: { mealPlanItemId?: string } };
      const mealId = target.mealPlanItemId;
      if (!mealId) return [];
      const previous = inv.previousCookedAt as string | null;
      return [
        mealPlanWrite((plans) =>
          plans.map((p) => ({ ...p, meals: p.meals.map((m) => (m.id === mealId ? { ...m, cookedAt: previous } : m)) })),
        ),
      ];
    }
    default:
      return [];
  }
}

/** Reverses an op's optimistic change from its stored inverse; invalid inverse -> refetch, no writes. */
export function rollbackOp(op: OutboxOp): RollbackResult {
  const inv = parseInverse(op);
  if (!inv) return { writes: [], needsRefetch: true };
  return { writes: writesFor(op, inv), needsRefetch: false };
}
