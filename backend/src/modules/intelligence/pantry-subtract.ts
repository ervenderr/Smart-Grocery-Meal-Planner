/**
 * Pure pantry subtraction. Never reads the clock: callers pass todayUtc.
 * Stock is summed in base units per (canonical name, unit family); expired
 * lots are ignored; incompatible families are neither converted nor subtracted.
 */

import { canonicalName } from './canonical';
import { IngredientGroup, displayOf, groupKey, withBaseTotal } from './merge-groups';
import { Dec, ZERO, finalizeQuantity, parseDec, round2 } from './quantity';
import { fromBase, resolveUnit, toBase } from './units';

export interface PantryStockItem {
  readonly ingredientName: string;
  readonly quantity: unknown;
  readonly unit: string;
  readonly expiryDate: Date | null;
}

export type CoveredStatus = 'full' | 'partial' | 'incompatible';

export interface CoveredEntry {
  readonly name: string;
  readonly needed: number;
  readonly have: number;
  readonly unit: string;
  readonly status: CoveredStatus;
  readonly haveUnit?: string;
}

interface OtherLot {
  readonly key: string;
  readonly quantity: Dec;
  readonly label: string;
}

interface StockIndex {
  readonly byKey: ReadonlyMap<string, Dec>;
  readonly otherByName: ReadonlyMap<string, readonly OtherLot[]>;
}

const MS_PER_DAY = 86_400_000;
const dayNumber = (d: Date): number => Math.floor(d.getTime() / MS_PER_DAY);

function indexStock(pantry: readonly PantryStockItem[], todayUtc: Date): StockIndex {
  const today = dayNumber(todayUtc);
  const byKey = new Map<string, Dec>();
  const otherByName = new Map<string, readonly OtherLot[]>();
  for (const item of pantry) {
    if (item.expiryDate && dayNumber(item.expiryDate) < today) continue;
    const qty = parseDec(item.quantity);
    if (!qty || !qty.gt(ZERO)) continue;
    const canonical = canonicalName(item.ingredientName);
    if (!canonical) continue;
    const resolved = resolveUnit(item.unit);
    const key = groupKey(item.ingredientName, item.unit);
    byKey.set(key, (byKey.get(key) ?? ZERO).plus(toBase(qty, resolved)));
    otherByName.set(canonical, [
      ...(otherByName.get(canonical) ?? []),
      { key, quantity: qty, label: resolved.label },
    ]);
  }
  return { byKey, otherByName };
}

function coveredEntry(
  group: IngredientGroup,
  stockBase: Dec,
  status: CoveredStatus,
): CoveredEntry {
  const { quantity, unit } = displayOf(group);
  return {
    name: group.displayName,
    needed: finalizeQuantity(quantity),
    have: finalizeQuantity(fromBase(stockBase, unit)),
    unit,
    status,
  };
}

function incompatibleEntry(group: IngredientGroup, lot: OtherLot): CoveredEntry {
  const { quantity, unit } = displayOf(group);
  return {
    name: group.displayName,
    needed: finalizeQuantity(quantity),
    have: finalizeQuantity(lot.quantity),
    unit,
    status: 'incompatible',
    haveUnit: lot.label,
  };
}

export function subtractPantry(
  groups: readonly IngredientGroup[],
  pantry: readonly PantryStockItem[],
  todayUtc: Date,
): { remaining: IngredientGroup[]; covered: CoveredEntry[] } {
  const { byKey, otherByName } = indexStock(pantry, todayUtc);
  const remaining: IngredientGroup[] = [];
  const covered: CoveredEntry[] = [];

  for (const group of groups) {
    const stock = byKey.get(group.key) ?? ZERO;
    if (stock.lte(ZERO)) {
      const other = (otherByName.get(group.canonical) ?? []).find((l) => l.key !== group.key);
      if (other) covered.push(incompatibleEntry(group, other));
      remaining.push(group);
      continue;
    }
    const missing = group.baseTotal.minus(stock);
    const remainingBase = missing.gt(ZERO) ? missing : ZERO;
    const { unit } = displayOf(group);
    if (round2(fromBase(remainingBase, unit)).isZero()) {
      covered.push(coveredEntry(group, stock, 'full'));
      continue;
    }
    covered.push(coveredEntry(group, stock, 'partial'));
    remaining.push(withBaseTotal(group, remainingBase));
  }
  return { remaining, covered };
}
