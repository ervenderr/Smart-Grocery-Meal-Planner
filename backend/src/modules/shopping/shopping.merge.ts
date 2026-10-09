/**
 * Pure merge of incoming ingredients into existing shopping list items.
 * Only UNCHECKED existing items absorb incoming quantities. Matching is by
 * canonical name + unit family; math is exact (Decimal) in base units.
 */

import { IngredientGroup, displayOf, groupIngredients, groupKey } from '../intelligence/merge-groups';
import { Dec, ZERO, finalizeQuantity, parseDec } from '../intelligence/quantity';
import { resolveUnit, toBase, toDisplay } from '../intelligence/units';
import { MAX_ITEM_NAME_LENGTH } from './shopping.constants';
import { inferCategory } from './shopping.category';

export interface ExistingItem {
  readonly id: string;
  readonly itemName: string;
  readonly unit: string;
  readonly quantity: number;
  readonly isChecked: boolean;
}

export interface IncomingItem {
  readonly itemName: string;
  readonly quantity: number | Dec;
  readonly unit: string;
}

export interface MergePlan {
  readonly updates: ReadonlyArray<{
    readonly id: string;
    readonly quantity: number;
    readonly unit: string;
  }>;
  readonly inserts: ReadonlyArray<{
    readonly itemName: string;
    readonly quantity: number;
    readonly unit: string;
    readonly category: string;
  }>;
}

export const mergeKey = (name: string, unit: string): string => groupKey(name, unit);

const cleanName = (raw: string): string =>
  raw.replace(/\s+/g, ' ').trim().slice(0, MAX_ITEM_NAME_LENGTH).trim();

/** Collapses incoming items into groups; zero, negative and non-finite amounts are skipped (WR-04). */
const groupIncoming = (incoming: readonly IncomingItem[]): IngredientGroup[] =>
  groupIngredients(
    incoming.flatMap((item) => {
      const quantity = parseDec(item.quantity);
      const name = cleanName(item.itemName);
      return quantity && quantity.gt(0) && name.length > 0
        ? [{ name, quantity, unit: item.unit }]
        : [];
    }),
  );

export function mergeIntoItems(
  existing: readonly ExistingItem[],
  incoming: readonly IncomingItem[],
): MergePlan {
  const unchecked = new Map<string, ExistingItem>();
  for (const item of existing) {
    const key = mergeKey(item.itemName, item.unit);
    if (!item.isChecked && !unchecked.has(key)) unchecked.set(key, item);
  }

  const updates: Array<MergePlan['updates'][number]> = [];
  const inserts: Array<MergePlan['inserts'][number]> = [];

  for (const group of groupIncoming(incoming)) {
    const match = unchecked.get(group.key);
    if (match) {
      // List quantities are stored at 2 dp, so the merge starts from the rounded
      // stored value (accepted drift, see RESEARCH).
      const unit = resolveUnit(match.unit);
      const existingQty = parseDec(match.quantity);
      const total = (existingQty ? toBase(existingQty, unit) : ZERO).plus(group.baseTotal);
      const shown = toDisplay({
        family: group.family,
        countLabel: group.countLabel,
        baseTotal: total,
        inputUnitKeys: [unit.unitKey, ...group.inputUnitKeys],
      });
      updates.push({ id: match.id, quantity: finalizeQuantity(shown.quantity), unit: shown.unit });
    } else {
      const shown = displayOf(group);
      inserts.push({
        itemName: group.displayName,
        quantity: finalizeQuantity(shown.quantity),
        unit: shown.unit,
        category: inferCategory(group.displayName),
      });
    }
  }
  return { updates, inserts };
}
