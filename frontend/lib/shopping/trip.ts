export const MAX_TRIP_TOTAL_CENTS = 2_000_000_000;

export interface TripItem {
  isChecked: boolean;
  costEstimateCents: number | null;
  actualCostCents: number | null;
}

export interface TripTotal {
  totalCents: number;
  checkedCount: number;
  uncheckedCount: number;
}

/** Trip total = checked items' actual, else estimate, else 0 (mirrors the backend). */
export function computeTripTotal(items: readonly TripItem[]): TripTotal {
  const checked = items.filter((i) => i.isChecked);
  const sum = checked.reduce((s, i) => s + (i.actualCostCents ?? i.costEstimateCents ?? 0), 0);
  return {
    totalCents: Math.min(sum, MAX_TRIP_TOTAL_CENTS),
    checkedCount: checked.length,
    uncheckedCount: items.length - checked.length,
  };
}

export type DifferenceTone = 'none' | 'under' | 'over' | 'even';

export function describeDifference(differenceCents: number | null): {
  tone: DifferenceTone;
  amountCents: number;
} {
  if (differenceCents === null) return { tone: 'none', amountCents: 0 };
  if (differenceCents < 0) return { tone: 'under', amountCents: -differenceCents };
  if (differenceCents > 0) return { tone: 'over', amountCents: differenceCents };
  return { tone: 'even', amountCents: 0 };
}

/**
 * Unambiguous wording for the summary difference: it only compares the items
 * that have an actual price against their own estimates.
 */
export function differenceLabel(tone: DifferenceTone, formattedAmount: string): string | null {
  switch (tone) {
    case 'under':
      return `Priced items: ${formattedAmount} under estimate`;
    case 'over':
      return `Priced items: ${formattedAmount} over estimate`;
    case 'even':
      return 'Priced items: on estimate';
    default:
      return null;
  }
}

/** The user's local calendar date as YYYY-MM-DD (not UTC). */
export function localIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
