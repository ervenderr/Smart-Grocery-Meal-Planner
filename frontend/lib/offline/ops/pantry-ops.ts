import type { CreatePantryItemData, PantryItem, UpdatePantryItemData } from '@/types/pantry.types';
import type { NewOp } from '../outbox/op-types';

const round2 = (n: number): number => Math.round(n * 100) / 100;
const label = (name: string): string => name.slice(0, 120) || 'Pantry item';

export function buildPantryCreate(data: CreatePantryItemData, id: string): NewOp {
  return {
    kind: 'pantry.create',
    label: label(data.ingredientName),
    payload: { item: { ...data, id } },
    inverse: {},
  };
}

function adjustOp(current: PantryItem, quantity: number): NewOp[] {
  const delta = round2(quantity - Number(current.quantity));
  if (delta === 0) return [];
  return [
    { kind: 'pantry.adjust', label: label(current.ingredientName), payload: { id: current.id, delta }, inverse: {} },
  ];
}

/** Non-quantity fields -> one pantry.update whose inverse records the previous values. */
function updateOp(current: PantryItem, patch: Omit<UpdatePantryItemData, 'quantity'>): NewOp[] {
  const keys = Object.keys(patch) as Array<keyof typeof patch>;
  if (keys.length === 0) return [];
  const previous: Record<string, unknown> = {};
  for (const key of keys) previous[key] = current[key] ?? null;
  return [
    {
      kind: 'pantry.update',
      label: label(current.ingredientName),
      payload: { id: current.id, patch },
      inverse: { previous },
    } as NewOp,
  ];
}

export function buildPantryUpdate(current: PantryItem, patch: UpdatePantryItemData): NewOp[] {
  const { quantity, ...rest } = patch;
  const defined = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
  return [
    ...updateOp(current, defined),
    ...(quantity !== undefined ? adjustOp(current, quantity) : []),
  ];
}

export function buildPantryQuickPatchOps(
  current: PantryItem,
  patch: { quantity?: number; expiryDate?: string | null },
): NewOp[] {
  return buildPantryUpdate(current, patch);
}

export function buildPantryDelete(item: PantryItem): NewOp {
  return {
    kind: 'pantry.delete',
    label: label(item.ingredientName),
    payload: { id: item.id },
    inverse: { item },
  };
}

const dayOf = (value: unknown): unknown => (typeof value === 'string' ? value.split('T')[0] : value);

/** Fields of `next` that differ from the displayed item, so a queued edit carries only real changes. */
export function changedFields(current: PantryItem, next: UpdatePantryItemData): UpdatePantryItemData {
  const entries = Object.entries(next).filter(([key, value]) => {
    if (value === undefined) return false;
    const existing = current[key as keyof PantryItem];
    if (key === 'quantity') return Number(existing) !== Number(value);
    if (key === 'expiryDate' || key === 'purchaseDate') return dayOf(existing ?? null) !== dayOf(value);
    return (existing ?? null) !== value;
  });
  return Object.fromEntries(entries) as UpdatePantryItemData;
}
