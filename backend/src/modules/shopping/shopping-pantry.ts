/**
 * Pure bought-it planner: decides, for each checked shopping item, whether to
 * merge into an existing pantry lot or create a new pantry row.
 *
 * No I/O, no clock reads (callers pass todayUtc), inputs are never mutated and
 * the working state is replaced immutably on every step.
 */

import { canonicalName } from '../intelligence/canonical';
import { D, Dec, parseDec, round2 } from '../intelligence/quantity';
import { familyKey, fromBase, resolveUnit, toBase } from '../intelligence/units';
import { PantryCategory, PantryUnit } from '../../types/pantry.types';
import { inferCategory } from './shopping.category';
import { MAX_QUANTITY } from './shopping.constants';

const MAX_NAME_LENGTH = 100;
const PIECES_KEY = 'pieces';

export interface CheckedItem {
  itemName: string;
  quantity: unknown;
  unit: string | null;
  category: string | null;
  actualCostCents: number | null;
  costEstimateCents: number | null;
}

export interface PantryLotRow {
  id: string;
  ingredientName: string;
  quantity: unknown;
  unit: string;
  expiryDate: Date | null;
  createdAt: Date;
}

export interface PantryCreate {
  ingredientName: string;
  quantity: number;
  unit: PantryUnit;
  category: PantryCategory;
  purchaseDate: Date;
  purchasePriceCents: number | null;
  notes: string | null;
}

export interface PantryMergePlan {
  /** `expiryDate: null` is set when merging into a used-up lot (stale expiry is dropped). */
  updates: { id: string; quantity: number; expiryDate?: null }[];
  creates: PantryCreate[];
  /** Pantry rows created (same-trip duplicates collapse into one row). */
  added: number;
  /** Checked lines merged into a pre-existing pantry lot. */
  merged: number;
  skipped: number;
}

/**
 * Coerces free-text shopping units to the closed PantryUnit list. Mass/volume
 * use the registry key (equal to the PantryUnit value); everything else is a
 * count and becomes 'pieces'. 'items'/'piece'/'pc'/blank are plain pieces
 * (coercedFrom null); other count words ('can', 'bunch') are reported.
 */
export function toPantryUnit(raw: string | null | undefined): {
  unit: PantryUnit;
  coercedFrom: string | null;
} {
  const resolved = resolveUnit(raw);
  if (resolved.family !== 'count') return { unit: resolved.unitKey as PantryUnit, coercedFrom: null };
  const word = typeof raw === 'string' ? raw.trim() : '';
  const isPlain = resolved.unitKey === PIECES_KEY;
  return { unit: PantryUnit.PIECES, coercedFrom: isPlain || word === '' ? null : word };
}

interface WorkingLot {
  readonly ref: string;
  readonly origin: 'lot' | 'create';
  readonly key: string;
  readonly unitKey: string;
  readonly quantity: Dec;
  readonly expiryMs: number | null;
  readonly createdMs: number;
  readonly changed: boolean;
  /** True when the lot was used up (qty <= 0) before this trip: its old expiry no longer applies. */
  readonly usedUp: boolean;
  readonly create: PantryCreate | null;
  readonly coercedFrom: string | null;
}

interface PlanState {
  readonly lots: readonly WorkingLot[];
  readonly merged: number;
  readonly skipped: number;
}

const keyOf = (name: string, unit: string): string =>
  `${canonicalName(name)}\u0000${familyKey(resolveUnit(unit))}`;

const cap = (d: Dec): Dec => {
  const rounded = round2(d);
  return rounded.gt(MAX_QUANTITY) ? new D(MAX_QUANTITY) : rounded;
};

const byExpiry = (a: WorkingLot, b: WorkingLot): number => {
  if (a.expiryMs !== b.expiryMs) {
    if (a.expiryMs === null) return 1;
    if (b.expiryMs === null) return -1;
    return a.expiryMs - b.expiryMs;
  }
  return a.createdMs - b.createdMs;
};

const toWorkingLot = (lot: PantryLotRow, todayMs: number): WorkingLot | null => {
  const qty = parseDec(lot.quantity);
  const expiryMs = lot.expiryDate ? lot.expiryDate.getTime() : null;
  if (qty === null || (expiryMs !== null && expiryMs < todayMs)) return null;
  return {
    ref: lot.id,
    origin: 'lot',
    key: keyOf(lot.ingredientName, lot.unit),
    unitKey: resolveUnit(lot.unit).unitKey,
    quantity: qty,
    expiryMs,
    createdMs: lot.createdAt.getTime(),
    changed: false,
    usedUp: qty.lte(0),
    create: null,
    coercedFrom: null,
  };
};

const priceOf = (item: CheckedItem): number | null =>
  item.actualCostCents ?? item.costEstimateCents ?? null;

const isCategory = (value: string | null): value is PantryCategory =>
  value !== null && (Object.values(PantryCategory) as string[]).includes(value);

function newCreate(
  item: CheckedItem,
  name: string,
  qty: Dec,
  coerced: ReturnType<typeof toPantryUnit>,
  purchaseDate: Date,
): PantryCreate {
  return {
    ingredientName: name,
    quantity: qty.toNumber(),
    unit: coerced.unit,
    category: isCategory(item.category) ? item.category : inferCategory(name),
    purchaseDate,
    purchasePriceCents: priceOf(item),
    notes: null,
  };
}

function step(
  state: PlanState,
  item: CheckedItem,
  purchaseDate: Date,
  seq: number,
): PlanState {
  const name = (typeof item.itemName === 'string' ? item.itemName : '').trim().slice(0, MAX_NAME_LENGTH);
  const raw = parseDec(item.quantity);
  const coerced = toPantryUnit(item.unit);
  const qty = raw === null ? null : cap(raw);
  if (name === '' || canonicalName(name) === '' || qty === null || qty.lte(0)) {
    return { ...state, skipped: state.skipped + 1 };
  }
  const key = keyOf(name, coerced.unit);
  const candidates = state.lots.filter((l) => l.key === key);
  // Prefer lots that still hold stock; a used-up lot is only a fallback target.
  const inStock = candidates.filter((l) => !l.usedUp);
  const target = [...(inStock.length > 0 ? inStock : candidates)].sort(byExpiry)[0];
  if (!target) {
    const create = newCreate(item, name, qty, coerced, purchaseDate);
    const lot: WorkingLot = {
      ref: `new:${seq}`,
      origin: 'create',
      key,
      unitKey: coerced.unit,
      quantity: qty,
      expiryMs: null,
      createdMs: Number.MAX_SAFE_INTEGER,
      changed: true,
      usedUp: false,
      create,
      coercedFrom: coerced.coercedFrom,
    };
    return { ...state, lots: [...state.lots, lot] };
  }
  const added = fromBase(toBase(qty, resolveUnit(coerced.unit)), target.unitKey);
  const total = cap(target.quantity.plus(added));
  const lots = state.lots.map((l) =>
    l.ref === target.ref
      ? { ...l, quantity: total, changed: true, expiryMs: l.usedUp ? null : l.expiryMs }
      : l,
  );
  return { ...state, lots, merged: state.merged + (target.origin === 'lot' ? 1 : 0) };
}

/**
 * Merge keeps the target lot's expiry: a fresh purchase merged into an older
 * lot inherits that lot's (sooner) expiry. This is the locked CONTEXT decision.
 * Exception: a used-up (qty 0) lot holds no food, so its stale expiry is cleared.
 */
export function planPantryMerge(args: {
  checked: readonly CheckedItem[];
  lots: readonly PantryLotRow[];
  purchaseDate: Date;
  todayUtc: Date;
}): PantryMergePlan {
  const { checked, lots, purchaseDate, todayUtc } = args;
  const todayMs = todayUtc.getTime();
  const start: PlanState = {
    lots: lots.map((l) => toWorkingLot(l, todayMs)).filter((l): l is WorkingLot => l !== null),
    merged: 0,
    skipped: 0,
  };
  const end = checked.reduce(
    (state, item, i) => step(state, item, purchaseDate, i),
    start,
  );
  const creates = end.lots
    .filter((l) => l.origin === 'create' && l.create)
    .map((l) => ({
      ...(l.create as PantryCreate),
      quantity: l.quantity.toNumber(),
      notes: l.coercedFrom ? `Bought as ${l.quantity.toNumber()} ${l.coercedFrom}` : null,
    }));
  const updates = end.lots
    .filter((l) => l.origin === 'lot' && l.changed)
    .map((l) => ({
      id: l.ref,
      quantity: l.quantity.toNumber(),
      ...(l.usedUp ? { expiryDate: null } : {}),
    }));
  return { updates, creates, added: creates.length, merged: end.merged, skipped: end.skipped };
}
