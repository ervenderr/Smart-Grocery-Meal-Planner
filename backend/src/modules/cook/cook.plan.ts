/**
 * Pure "Cooked it" planner (CAP-04). No clock, no DB: callers pass todayUtc.
 *
 * Rules: scale by servings; subtract only within a unit family (never convert
 * across families); floor at 0; ingredients absent from the pantry and staples
 * are listed, not deducted. Math is Decimal and rounds once at output.
 */

import { aggregateGroups } from '../mealplan/mealplan.aggregate';
import { canonicalName } from '../intelligence/canonical';
import { IngredientGroup, displayOf } from '../intelligence/merge-groups';
import { Dec, ZERO, parseDec, round2 } from '../intelligence/quantity';
import { filterStaples } from '../intelligence/staples';
import { familyKey, fromBase, resolveUnit, toBase } from '../intelligence/units';

export interface CookLot {
  readonly id: string;
  readonly ingredientName: string;
  readonly quantity: unknown;
  readonly unit: string;
  readonly expiryDate: Date | null;
  readonly createdAt: Date;
}

export type CookRowStatus = 'ok' | 'short' | 'mismatch';

export interface CookRow {
  readonly key: string;
  readonly name: string;
  readonly unit: string;
  readonly have: number;
  readonly use: number;
  readonly left: number;
  readonly status: CookRowStatus;
  readonly recipeQuantity?: number;
  readonly recipeUnit?: string;
}

export interface CookPlan {
  readonly rows: CookRow[];
  readonly notInPantry: string[];
  readonly staples: string[];
  readonly ingredientCount: number;
}

export class CookUnitMismatchError extends Error {
  constructor(key: string, unit: string) {
    super(`Unit "${unit}" is not in the same unit family as "${key}"`);
    this.name = 'CookUnitMismatchError';
  }
}

const MS_PER_DAY = 86_400_000;
const dayNumber = (d: Date): number => Math.floor(d.getTime() / MS_PER_DAY);

export const cookKey = (name: string, unit: string): string =>
  `${canonicalName(name)}|${familyKey(resolveUnit(unit))}`;

interface UsableLot {
  readonly lot: CookLot;
  readonly key: string;
  readonly qty: Dec;
  readonly unitKey: string;
  readonly base: Dec;
}

const byFefo = (a: UsableLot, b: UsableLot): number => {
  const ea = a.lot.expiryDate ? a.lot.expiryDate.getTime() : Infinity;
  const eb = b.lot.expiryDate ? b.lot.expiryDate.getTime() : Infinity;
  if (ea !== eb) return ea < eb ? -1 : 1;
  return a.lot.createdAt.getTime() - b.lot.createdAt.getTime();
};

/** Non-expired, positive-quantity lots in first-expiring-first order. */
function usableLots(lots: readonly CookLot[], todayUtc: Date): UsableLot[] {
  const today = dayNumber(todayUtc);
  const result: UsableLot[] = [];
  for (const lot of lots) {
    if (lot.expiryDate && dayNumber(lot.expiryDate) < today) continue;
    const qty = parseDec(lot.quantity);
    if (!qty || !qty.gt(ZERO)) continue;
    if (!canonicalName(lot.ingredientName)) continue;
    const resolved = resolveUnit(lot.unit);
    result.push({
      lot,
      key: cookKey(lot.ingredientName, lot.unit),
      qty,
      unitKey: resolved.unitKey,
      base: toBase(qty, resolved),
    });
  }
  return result.sort(byFefo);
}

const groupBy = <T>(items: readonly T[], keyOf: (t: T) => string): Map<string, T[]> => {
  const map = new Map<string, T[]>();
  for (const item of items) map.set(keyOf(item), [...(map.get(keyOf(item)) ?? []), item]);
  return map;
};

const sumBase = (lots: readonly UsableLot[]): Dec =>
  lots.reduce((acc, l) => acc.plus(l.base), ZERO);

function sameFamilyRow(group: IngredientGroup, key: string, lots: readonly UsableLot[]): CookRow {
  const first = lots[0];
  const haveBase = sumBase(lots);
  const takeBase = group.baseTotal.lt(haveBase) ? group.baseTotal : haveBase;
  const inUnit = (base: Dec): number => round2(fromBase(base, first.unitKey)).toNumber();
  return {
    key,
    name: first.lot.ingredientName,
    unit: first.lot.unit,
    have: inUnit(haveBase),
    use: inUnit(takeBase),
    left: inUnit(haveBase.minus(takeBase)),
    status: group.baseTotal.gt(haveBase) ? 'short' : 'ok',
  };
}

function mismatchRow(group: IngredientGroup, key: string, lots: readonly UsableLot[]): CookRow {
  const first = lots[0];
  const have = round2(fromBase(sumBase(lots), first.unitKey)).toNumber();
  const recipe = displayOf(group);
  return {
    key,
    name: first.lot.ingredientName,
    unit: first.lot.unit,
    have,
    use: 0,
    left: have,
    status: 'mismatch',
    recipeQuantity: round2(recipe.quantity).toNumber(),
    recipeUnit: recipe.unit,
  };
}

function rowsFor(
  group: IngredientGroup,
  lotsByKey: ReadonlyMap<string, UsableLot[]>,
  lotsByName: ReadonlyMap<string, UsableLot[]>,
): { rows: CookRow[]; missing: boolean } {
  const familyPart = group.key.split('\u0000')[1];
  const ownKey = `${group.canonical}|${familyPart}`;
  const own = lotsByKey.get(ownKey);
  if (own) return { rows: [sameFamilyRow(group, ownKey, own)], missing: false };

  const foreignKeys = [...new Set((lotsByName.get(group.canonical) ?? []).map((l) => l.key))];
  const rows = foreignKeys.flatMap((k) => {
    const lots = lotsByKey.get(k);
    return lots ? [mismatchRow(group, k, lots)] : [];
  });
  return { rows, missing: rows.length === 0 };
}

export function computeCookPlan(args: {
  recipe: { servings: number; title: string; ingredientsList: unknown };
  servings: number;
  lots: readonly CookLot[];
  staples: ReadonlySet<string>;
  todayUtc: Date;
}): CookPlan {
  const { groups, ingredientCount } = aggregateGroups([
    { servings: args.servings, recipe: args.recipe },
  ]);
  const { kept, skipped } = filterStaples(groups, args.staples);
  const usable = usableLots(args.lots, args.todayUtc);
  const lotsByKey = groupBy(usable, (l) => l.key);
  const lotsByName = groupBy(usable, (l) => canonicalName(l.lot.ingredientName));

  const rows: CookRow[] = [];
  const notInPantry: string[] = [];
  for (const group of kept) {
    const result = rowsFor(group, lotsByKey, lotsByName);
    rows.push(...result.rows);
    if (result.missing) notInPantry.push(group.displayName);
  }
  return { rows, notInPantry, staples: skipped, ingredientCount };
}

/**
 * FEFO deduction of `use` (in `unit`) from the usable lots of `key`.
 * Total take is clamped to what is held; zero-take lots are not returned.
 */
export function allocateDeduction(args: {
  lots: readonly CookLot[];
  key: string;
  unit: string;
  use: number;
  todayUtc: Date;
}): { updates: { id: string; quantity: number }[]; usedUp: number } {
  const resolved = resolveUnit(args.unit);
  if (!args.key.endsWith(`|${familyKey(resolved)}`)) {
    throw new CookUnitMismatchError(args.key, args.unit);
  }
  const useQty = parseDec(args.use);
  const lots = usableLots(args.lots, args.todayUtc).filter((l) => l.key === args.key);
  const updates: { id: string; quantity: number }[] = [];
  let usedUp = 0;
  let remaining = useQty && useQty.gt(ZERO) ? toBase(useQty, resolved) : ZERO;

  for (const l of lots) {
    if (remaining.lte(ZERO)) break;
    const take = remaining.lt(l.base) ? remaining : l.base;
    const next = round2(fromBase(l.base.minus(take), l.unitKey));
    updates.push({ id: l.lot.id, quantity: next.toNumber() });
    if (next.isZero()) usedUp += 1;
    remaining = remaining.minus(take);
  }
  return { updates, usedUp };
}
