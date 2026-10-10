/**
 * Pantry index: canonical ingredient name -> base totals per unit family
 * plus the soonest non-expired expiry. Pure; "today" is injected.
 */
import { canonicalName } from '@/lib/preferences/canonical';
import { getDaysUntilExpiry } from '@/lib/pantry/expiry';
import { familyKey, resolveUnit, toBase } from './units';
import type { RulesPantryItem } from './types';

export const MAX_PANTRY_ITEMS = 2000;

export interface PantryEntry {
  readonly displayName: string;
  readonly baseByFamily: ReadonlyMap<string, number>;
  readonly minDaysLeft: number | null;
}

export interface PantryIndex {
  readonly entries: ReadonlyMap<string, PantryEntry>;
  readonly capped: boolean;
}

interface Acc {
  displayName: string;
  base: Map<string, number>;
  minDays: number | null;
}

function parseToday(today: string): Date {
  const [y, m, d] = today.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function buildPantryIndex(items: readonly RulesPantryItem[], today: string): PantryIndex {
  const now = parseToday(today);
  const capped = items.length > MAX_PANTRY_ITEMS;
  const accs = new Map<string, Acc>();
  for (const item of items.slice(0, MAX_PANTRY_ITEMS)) {
    const name = canonicalName(item.ingredientName);
    const qty = Number(item.quantity);
    if (name === '' || !Number.isFinite(qty) || qty <= 0) continue;
    const days = getDaysUntilExpiry(item.expiryDate, now);
    if (days !== null && days < 0) continue;
    const unit = resolveUnit(item.unit);
    const key = familyKey(unit);
    const acc = accs.get(name) ?? {
      displayName: String(item.ingredientName).trim(),
      base: new Map<string, number>(),
      minDays: null,
    };
    acc.base.set(key, (acc.base.get(key) ?? 0) + toBase(qty, unit));
    if (days !== null) acc.minDays = acc.minDays === null ? days : Math.min(acc.minDays, days);
    accs.set(name, acc);
  }
  const entries = new Map<string, PantryEntry>();
  for (const [name, acc] of accs) {
    entries.set(
      name,
      Object.freeze({
        displayName: acc.displayName,
        baseByFamily: Object.freeze(acc.base) as ReadonlyMap<string, number>,
        minDaysLeft: acc.minDays,
      }),
    );
  }
  return Object.freeze({ entries: Object.freeze(entries) as ReadonlyMap<string, PantryEntry>, capped });
}

export function pantryHas(index: PantryIndex, canonical: string): boolean {
  const entry = index.entries.get(canonical);
  if (!entry) return false;
  for (const v of entry.baseByFamily.values()) if (v > 0) return true;
  return false;
}
