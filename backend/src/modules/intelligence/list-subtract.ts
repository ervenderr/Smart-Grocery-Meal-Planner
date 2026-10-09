/**
 * Pure subtraction of what is already UNCHECKED on the active shopping list,
 * treated like pantry stock so generating the same plan twice adds nothing.
 * Checked items are ignored (they are bought, matching the Phase 4 merge
 * rules). Same exact Decimal math as pantry subtraction.
 */

import { IngredientGroup, displayOf, groupKey, withBaseTotal } from './merge-groups';
import { CoveredEntry, coveredEntry } from './pantry-subtract';
import { Dec, ZERO, parseDec, round2 } from './quantity';
import { fromBase, resolveUnit, toBase } from './units';

export interface ListStockItem {
  readonly itemName: string;
  readonly quantity: unknown;
  readonly unit: string;
  readonly isChecked: boolean;
}

function indexListStock(items: readonly ListStockItem[]): ReadonlyMap<string, Dec> {
  const byKey = new Map<string, Dec>();
  for (const item of items) {
    if (item.isChecked) continue;
    const qty = parseDec(item.quantity);
    if (!qty || !qty.gt(ZERO)) continue;
    const key = groupKey(item.itemName, item.unit);
    byKey.set(key, (byKey.get(key) ?? ZERO).plus(toBase(qty, resolveUnit(item.unit))));
  }
  return byKey;
}

export function subtractListStock(
  groups: readonly IngredientGroup[],
  listItems: readonly ListStockItem[],
): { remaining: IngredientGroup[]; covered: CoveredEntry[] } {
  const stockByKey = indexListStock(listItems);
  const remaining: IngredientGroup[] = [];
  const covered: CoveredEntry[] = [];

  for (const group of groups) {
    const stock = stockByKey.get(group.key) ?? ZERO;
    if (stock.lte(ZERO)) {
      remaining.push(group);
      continue;
    }
    covered.push(coveredEntry(group, stock, 'on_list'));
    const missing = group.baseTotal.minus(stock);
    const { unit } = displayOf(group);
    if (missing.gt(ZERO) && !round2(fromBase(missing, unit)).isZero()) {
      remaining.push(withBaseTotal(group, missing));
    }
  }
  return { remaining, covered };
}
