/**
 * Pure quantity helpers for pantry quick edit (CAP-05).
 * No React, no I/O: safe to reuse from any component.
 */

export const MAX_QUANTITY = 99999;

const STEP_BY_UNIT: Readonly<Record<string, number>> = Object.freeze({
  pieces: 1,
  items: 1,
  grams: 50,
  kg: 0.25,
  ml: 50,
  liters: 0.25,
  oz: 1,
  lbs: 0.25,
  cups: 0.25,
  tbsp: 1,
  tsp: 1,
  fl_oz: 1,
  // tolerant aliases
  g: 50,
  l: 0.25,
  cup: 0.25,
  pcs: 1,
  lb: 0.25,
});

const DEFAULT_STEP = 1;

const round2 = (n: number): number => Math.round(n * 100) / 100;

export function stepForUnit(unit: string): number {
  const key = (unit ?? '').trim().toLowerCase();
  return STEP_BY_UNIT[key] ?? DEFAULT_STEP;
}

export function clampQuantity(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return round2(Math.min(MAX_QUANTITY, Math.max(0, n)));
}

export function stepQuantity(value: number, unit: string, direction: 1 | -1): number {
  return clampQuantity(value + direction * stepForUnit(unit));
}

export function formatQuantity(n: number): string {
  return String(round2(n));
}

export type ParsedQuantity =
  | { ok: true; value: number }
  | { ok: false; error: 'invalid' | 'negative' | 'too_large' };

const NUMBER_PATTERN = /^-?\d+(\.\d+)?$/;

export function parseQuantityInput(raw: string): ParsedQuantity {
  const text = (raw ?? '').trim();
  if (!NUMBER_PATTERN.test(text)) return { ok: false, error: 'invalid' };
  const value = Number(text);
  if (value < 0) return { ok: false, error: 'negative' };
  if (value > MAX_QUANTITY) return { ok: false, error: 'too_large' };
  return { ok: true, value: round2(value) };
}

export function sortUsedUpLast<T extends { quantity: number | string }>(
  items: readonly T[]
): T[] {
  const isUsedUp = (item: T) => Number(item.quantity) === 0;
  return [...items.filter((i) => !isUsedUp(i)), ...items.filter(isUsedUp)];
}
