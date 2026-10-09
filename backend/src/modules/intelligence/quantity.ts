/**
 * Exact quantity math for the intelligence module.
 *
 * Rule: sum in base units, divide last, round once at output.
 * Uses an isolated Decimal clone so Prisma's shared Decimal config
 * (precision 20) is never mutated.
 */

import { Decimal } from '@prisma/client/runtime/library';
import { MAX_QUANTITY, MIN_QUANTITY } from '../shopping/shopping.constants';

export const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
export type Dec = InstanceType<typeof D>;
export const ZERO: Dec = new D(0);

/** Convert a number/string/Dec to Dec. Numbers go through String(n). Throws on non-finite. */
export function toDec(value: number | string | Dec): Dec {
  const d = new D(typeof value === 'number' ? String(value) : value);
  if (!d.isFinite()) throw new Error('Quantity must be a finite number');
  return d;
}

/** Never-throwing boundary variant: returns null for anything not a finite number-like. */
export function parseDec(value: unknown): Dec | null {
  try {
    if (typeof value === 'number') return Number.isFinite(value) ? toDec(value) : null;
    if (typeof value === 'string') {
      const text = value.trim();
      return text.length > 0 ? toDec(text) : null;
    }
    if (typeof value === 'object' && value !== null && Decimal.isDecimal(value)) {
      return toDec(String(value));
    }
    return null;
  } catch {
    return null;
  }
}

/** Round half up to 2 decimal places. */
export function round2(d: Dec): Dec {
  return d.toDecimalPlaces(2, D.ROUND_HALF_UP);
}

/** Round once, clamp to [MIN_QUANTITY, MAX_QUANTITY], return a JS number. Positive inputs only. */
export function finalizeQuantity(d: Dec): number {
  const rounded = round2(d).toNumber();
  return Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, rounded));
}
