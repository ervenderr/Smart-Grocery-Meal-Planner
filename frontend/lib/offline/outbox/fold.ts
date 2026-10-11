import type { MealPlan } from '@/types/mealplan.types';
import type { PantryItem } from '@/types/pantry.types';
import type { ShoppingItem, ShoppingList } from '@/types/shopping.types';
import { applyItemPatch, removeItem, upsertItem } from '@/lib/shopping/list-cache';
import type { NewOp, OpKind, OutboxOp } from './op-types';

type PayloadOf<K extends OpKind> = Extract<NewOp, { kind: K }>['payload'];

const payloadOf = <K extends OpKind>(op: OutboxOp, _kind: K): PayloadOf<K> => op.payload as PayloadOf<K>;
const iso = (ms: number): string => new Date(ms).toISOString();
const round2 = (n: number): number => Math.round(n * 100) / 100;

function toShoppingItem(listId: string, op: OutboxOp): ShoppingItem {
  const { item } = payloadOf(op, 'shopping.item.create');
  return {
    shoppingListId: listId,
    quantity: 1,
    unit: '',
    costEstimateCents: null,
    actualCostCents: null,
    isChecked: false,
    notes: null,
    ...item,
    category: item.category ?? 'other',
    createdAt: iso(op.createdAt),
    updatedAt: iso(op.createdAt),
  } as unknown as ShoppingItem;
}

function foldShoppingOp(list: ShoppingList, op: OutboxOp): ShoppingList {
  switch (op.kind) {
    case 'shopping.item.create': {
      const { item } = payloadOf(op, 'shopping.item.create');
      if (list.items.some((i) => i.id === item.id)) return list;
      return upsertItem(list, toShoppingItem(list.id, op)) ?? list;
    }
    case 'shopping.item.update': {
      const { id, patch } = payloadOf(op, 'shopping.item.update');
      return applyItemPatch(list, id, patch) ?? list;
    }
    case 'shopping.item.delete':
      return removeItem(list, payloadOf(op, 'shopping.item.delete').id).list ?? list;
    case 'shopping.finish': {
      const { input } = payloadOf(op, 'shopping.finish');
      const keep = input.carryOver === 'discard' ? [] : list.items.filter((i) => !i.isChecked);
      return { ...list, items: keep };
    }
    default:
      return list;
  }
}

/** Re-applies every op still in the outbox (any state) over a server snapshot, in seq order. */
export function foldShoppingList(list: ShoppingList, ops: readonly OutboxOp[]): ShoppingList {
  return [...ops].sort((a, b) => a.seq - b.seq).reduce(foldShoppingOp, list);
}

function foldPantryOp(items: readonly PantryItem[], op: OutboxOp): PantryItem[] {
  switch (op.kind) {
    case 'pantry.create': {
      const { item } = payloadOf(op, 'pantry.create');
      if (items.some((i) => i.id === item.id)) return [...items];
      const stamp = iso(op.createdAt);
      return [...items, { ...item, userId: op.userId, createdAt: stamp, updatedAt: stamp }];
    }
    case 'pantry.adjust': {
      const { id, delta } = payloadOf(op, 'pantry.adjust');
      return items.map((i) => (i.id === id ? { ...i, quantity: Math.max(0, round2(i.quantity + delta)) } : i));
    }
    case 'pantry.update': {
      const { id, patch } = payloadOf(op, 'pantry.update');
      return items.map((i) => (i.id === id ? { ...i, ...patch } : i));
    }
    case 'pantry.delete': {
      const { id } = payloadOf(op, 'pantry.delete');
      return items.filter((i) => i.id !== id);
    }
    default:
      return [...items];
  }
}

export function foldPantryList(items: readonly PantryItem[], ops: readonly OutboxOp[]): PantryItem[] {
  return [...ops].sort((a, b) => a.seq - b.seq).reduce<PantryItem[]>(foldPantryOp, [...items]);
}

export function foldMealPlans(plans: readonly MealPlan[], ops: readonly OutboxOp[]): MealPlan[] {
  const cooked = new Map<string, string>();
  for (const op of [...ops].sort((a, b) => a.seq - b.seq)) {
    if (op.kind !== 'cook.apply') continue;
    const { target, occurredAt } = payloadOf(op, 'cook.apply');
    if ('mealPlanItemId' in target) cooked.set(target.mealPlanItemId, occurredAt);
  }
  if (cooked.size === 0) return [...plans];
  return plans.map((plan) => ({
    ...plan,
    meals: plan.meals.map((m) => (cooked.has(m.id) ? { ...m, cookedAt: cooked.get(m.id) } : m)),
  }));
}
