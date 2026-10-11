import type { CreateShoppingItemInput, ShoppingItem, UpdateShoppingItemInput } from '@/types/shopping.types';
import type { NewOp } from '../outbox/op-types';

const FALLBACK_LABEL = 'Shopping item';

export function buildShoppingCreate(input: CreateShoppingItemInput, id: string): NewOp {
  return {
    kind: 'shopping.item.create',
    label: input.itemName.slice(0, 120) || FALLBACK_LABEL,
    payload: { item: { ...input, id } },
    inverse: {},
  };
}

export function buildShoppingUpdate(
  item: ShoppingItem | undefined,
  id: string,
  patch: UpdateShoppingItemInput,
): NewOp {
  const previous: Record<string, unknown> = {};
  if (item) {
    for (const key of Object.keys(patch) as Array<keyof UpdateShoppingItemInput>) {
      previous[key] = item[key];
    }
  }
  return {
    kind: 'shopping.item.update',
    label: (item?.itemName ?? patch.itemName ?? FALLBACK_LABEL).slice(0, 120),
    payload: { id, patch },
    inverse: { previous },
  };
}

export function buildShoppingDelete(item: ShoppingItem): NewOp {
  return {
    kind: 'shopping.item.delete',
    label: item.itemName.slice(0, 120) || FALLBACK_LABEL,
    payload: { id: item.id },
    inverse: { item },
  };
}
