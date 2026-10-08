/**
 * Pure history totals for a finished shopping trip.
 */

import { MAX_HISTORY_TOTAL_CENTS } from './shopping.constants';

export interface TotalsItem {
  readonly isChecked: boolean;
  readonly actualCostCents: number | null;
  readonly costEstimateCents: number | null;
}

export interface HistoryTotals {
  readonly totalCents: number;
  readonly estimatedCents: number;
  readonly itemCount: number;
  readonly checkedCount: number;
}

const clamp = (n: number): number => Math.min(n, MAX_HISTORY_TOTAL_CENTS);

/** Total = sum over CHECKED items of actual ?? estimate ?? 0, clamped to int4-safe. */
export const computeHistoryTotals = (items: readonly TotalsItem[]): HistoryTotals => {
  const checked = items.filter((i) => i.isChecked);
  const total = checked.reduce((sum, i) => sum + (i.actualCostCents ?? i.costEstimateCents ?? 0), 0);
  const estimated = checked.reduce((sum, i) => sum + (i.costEstimateCents ?? 0), 0);
  return {
    totalCents: clamp(total),
    estimatedCents: clamp(estimated),
    itemCount: items.length,
    checkedCount: checked.length,
  };
};
