export interface PricedItem {
  costEstimateCents: number | null;
  actualCostCents: number | null;
}

export interface ShoppingTotals {
  /** Estimate of every item on the list (priced or not). */
  estimatedCents: number;
  /** Estimate of only the items that have an actual; the basis of `differenceCents`. */
  estimatedForPricedCents: number;
  actualCents: number;
  /** Actual minus the estimates of only the items that have an actual; null when none. */
  differenceCents: number | null;
  itemsWithActual: number;
}

/** Integer-cent totals; no float math. */
export function computeTotals(items: readonly PricedItem[]): ShoppingTotals {
  const estimatedCents = items.reduce((sum, i) => sum + (i.costEstimateCents ?? 0), 0);
  const withActual = items.filter((i) => i.actualCostCents !== null);
  if (withActual.length === 0) {
    return {
      estimatedCents,
      estimatedForPricedCents: 0,
      actualCents: 0,
      differenceCents: null,
      itemsWithActual: 0,
    };
  }
  const actualCents = withActual.reduce((sum, i) => sum + (i.actualCostCents ?? 0), 0);
  const comparableEstimate = withActual.reduce((sum, i) => sum + (i.costEstimateCents ?? 0), 0);
  return {
    estimatedCents,
    estimatedForPricedCents: comparableEstimate,
    actualCents,
    differenceCents: actualCents - comparableEstimate,
    itemsWithActual: withActual.length,
  };
}
