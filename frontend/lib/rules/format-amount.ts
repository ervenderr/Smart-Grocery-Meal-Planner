/**
 * Kitchen-friendly amount and unit formatting for substitution ratios.
 * Pure and deterministic (no Intl).
 */

import { formatQuantity } from '../pantry/quantity';

export const FRACTION_TOLERANCE = 0.02;

interface Fraction {
  readonly value: number;
  readonly text: string;
}

const FRACTIONS: readonly Fraction[] = Object.freeze([
  Object.freeze({ value: 1 / 4, text: '1/4' }),
  Object.freeze({ value: 1 / 3, text: '1/3' }),
  Object.freeze({ value: 1 / 2, text: '1/2' }),
  Object.freeze({ value: 2 / 3, text: '2/3' }),
  Object.freeze({ value: 3 / 4, text: '3/4' }),
]);

const FRACTION_UNITS: ReadonlySet<string> = new Set(['cups', 'tbsp', 'tsp', 'fl_oz', 'pieces']);

interface UnitWords {
  readonly one: string;
  readonly many: string;
}

const UNIT_LABELS: Readonly<Record<string, UnitWords>> = Object.freeze({
  cups: { one: 'cup', many: 'cups' },
  tbsp: { one: 'tbsp', many: 'tbsp' },
  tsp: { one: 'tsp', many: 'tsp' },
  fl_oz: { one: 'fl oz', many: 'fl oz' },
  grams: { one: 'g', many: 'g' },
  kg: { one: 'kg', many: 'kg' },
  oz: { one: 'oz', many: 'oz' },
  lbs: { one: 'lb', many: 'lbs' },
  ml: { one: 'ml', many: 'ml' },
  liters: { one: 'liter', many: 'liters' },
  pieces: { one: '', many: '' },
  items: { one: '', many: '' },
});

function joinWhole(whole: number, fraction: string): string {
  return whole === 0 ? fraction : `${whole} ${fraction}`;
}

function fractionFormat(value: number): string {
  const whole = Math.floor(value);
  const frac = value - whole;
  if (frac <= FRACTION_TOLERANCE) return whole === 0 ? formatQuantity(value) : String(whole);
  if (1 - frac <= FRACTION_TOLERANCE) return String(whole + 1);
  const hit = FRACTIONS.find((f) => Math.abs(f.value - frac) <= FRACTION_TOLERANCE);
  return hit ? joinWhole(whole, hit.text) : formatQuantity(value);
}

export function formatAmount(value: number, unitKey: string): string {
  if (!Number.isFinite(value) || value < 0) return '0';
  return FRACTION_UNITS.has(unitKey) ? fractionFormat(value) : formatQuantity(value);
}

export function unitLabel(unitKey: string, value: number): string {
  const words = Object.prototype.hasOwnProperty.call(UNIT_LABELS, unitKey)
    ? UNIT_LABELS[unitKey]
    : undefined;
  if (!words) return unitKey;
  return value === 1 ? words.one : words.many;
}
