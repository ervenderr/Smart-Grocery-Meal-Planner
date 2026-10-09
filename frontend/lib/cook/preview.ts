/** Pure helpers for the "Cooked it" preview sheet (CAP-04). */
import { parseQuantityInput } from '@/lib/pantry/quantity';
import type { CookApplyResult, CookDeduction, CookRow } from '@/types/cook.types';

const round2 = (n: number): number => Math.round(n * 100) / 100;

export interface ClampedUse {
  value: number;
  clamped: boolean;
  error: 'invalid' | 'negative' | null;
}

export function clampUse(raw: string, have: number): ClampedUse {
  if ((raw ?? '').trim() === '') return { value: 0, clamped: false, error: null };
  const parsed = parseQuantityInput(raw);
  if (!parsed.ok) {
    if (parsed.error === 'too_large') return { value: have, clamped: true, error: null };
    return { value: 0, clamped: false, error: parsed.error };
  }
  if (parsed.value > have) return { value: have, clamped: true, error: null };
  return { value: parsed.value, clamped: false, error: null };
}

export function leftFor(have: number, use: number): number {
  return Math.max(0, round2(round2(have) - round2(use)));
}

export function toDeductions(
  rows: readonly CookRow[],
  uses: Readonly<Record<string, number>>
): CookDeduction[] {
  return rows.flatMap((row) => {
    const use = uses[row.key] ?? row.use;
    return use > 0 ? [{ key: row.key, unit: row.unit, use }] : [];
  });
}

export function deductionCount(
  rows: readonly CookRow[],
  uses: Readonly<Record<string, number>>
): number {
  return toDeductions(rows, uses).length;
}

export function cookSuccessToast(result: CookApplyResult): string {
  const noun = result.updated === 1 ? 'item' : 'items';
  const used = result.usedUp > 0 ? `, ${result.usedUp} used up` : '';
  return `Pantry updated. ${result.updated} ${noun} used${used}.`;
}

/**
 * True while the shown preview may not match the servings on screen: the
 * servings are still debouncing, a new preview is loading, or the visible data
 * is the previous servings' placeholder. Apply must stay disabled meanwhile,
 * because the payload carries deductions from the displayed preview only.
 */
export function isPreviewStale(state: {
  servings: number | null;
  debouncedServings: number | null;
  isPlaceholderData: boolean;
  isFetching: boolean;
}): boolean {
  return (
    state.servings !== state.debouncedServings ||
    state.isPlaceholderData ||
    state.isFetching
  );
}
