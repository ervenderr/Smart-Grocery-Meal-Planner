/**
 * Pure merge of incoming ingredients into existing shopping list items.
 * Only UNCHECKED existing items absorb incoming quantities.
 */

import {
  MAX_ITEM_NAME_LENGTH,
  MAX_QUANTITY,
  MIN_QUANTITY,
} from './shopping.constants';
import { inferCategory } from './shopping.category';
import { coerceUnit } from './shopping.units';

export interface ExistingItem {
  readonly id: string;
  readonly itemName: string;
  readonly unit: string;
  readonly quantity: number;
  readonly isChecked: boolean;
}

export interface IncomingItem {
  readonly itemName: string;
  readonly quantity: number;
  readonly unit: string;
}

export interface MergePlan {
  readonly updates: ReadonlyArray<{ readonly id: string; readonly quantity: number }>;
  readonly inserts: ReadonlyArray<{
    readonly itemName: string;
    readonly quantity: number;
    readonly unit: string;
    readonly category: string;
  }>;
}

const SEP = '\u0000';
const MAX_HUNDREDTHS = Math.round(MAX_QUANTITY * 100);
const MIN_HUNDREDTHS = Math.round(MIN_QUANTITY * 100);

export const mergeKey = (name: string, unit: string): string =>
  `${name.trim().toLowerCase()}${SEP}${unit.trim().toLowerCase()}`;

/** Positive amounts round to hundredths, clamped to [MIN_QUANTITY, MAX_QUANTITY]. */
const toHundredths = (q: number): number =>
  Math.min(MAX_HUNDREDTHS, Math.max(MIN_HUNDREDTHS, Math.round(q * 100)));

interface Clean {
  readonly itemName: string;
  readonly unit: string;
  readonly hundredths: number;
}

/**
 * Rule: incoming lines with a zero, negative or non-finite quantity (for
 * example "salt, 0 tsp") are skipped rather than coerced to 1.
 */
const clean = (item: IncomingItem): Clean | null => {
  if (!Number.isFinite(item.quantity) || item.quantity <= 0) return null;
  const itemName = item.itemName.replace(/\s+/g, ' ').trim().slice(0, MAX_ITEM_NAME_LENGTH).trim();
  if (itemName.length === 0) return null;
  return { itemName, unit: coerceUnit(item.unit), hundredths: toHundredths(item.quantity) };
};

/** Collapses duplicate incoming items (first-seen text wins). */
const collapseIncoming = (incoming: readonly IncomingItem[]): Clean[] => {
  const map = new Map<string, Clean>();
  for (const raw of incoming) {
    const c = clean(raw);
    if (!c) continue;
    const key = mergeKey(c.itemName, c.unit);
    const prev = map.get(key);
    map.set(
      key,
      prev ? { ...prev, hundredths: Math.min(MAX_HUNDREDTHS, prev.hundredths + c.hundredths) } : c,
    );
  }
  return Array.from(map.values());
};

export function mergeIntoItems(
  existing: readonly ExistingItem[],
  incoming: readonly IncomingItem[],
): MergePlan {
  const unchecked = new Map<string, ExistingItem>();
  for (const item of existing) {
    const key = mergeKey(item.itemName, item.unit);
    if (!item.isChecked && !unchecked.has(key)) unchecked.set(key, item);
  }

  const updates: Array<{ id: string; quantity: number }> = [];
  const inserts: Array<MergePlan['inserts'][number]> = [];

  for (const c of collapseIncoming(incoming)) {
    const match = unchecked.get(mergeKey(c.itemName, c.unit));
    if (match) {
      const sum = Math.min(MAX_HUNDREDTHS, Math.round(match.quantity * 100) + c.hundredths);
      updates.push({ id: match.id, quantity: sum / 100 });
    } else {
      inserts.push({
        itemName: c.itemName,
        quantity: c.hundredths / 100,
        unit: c.unit,
        category: inferCategory(c.itemName),
      });
    }
  }
  return { updates, inserts };
}
