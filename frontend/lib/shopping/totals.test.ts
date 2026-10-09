import { describe, expect, it } from 'vitest';
import { computeTotals } from './totals';

describe('computeTotals', () => {
  it('returns zeros for empty list', () => {
    expect(computeTotals([])).toEqual({
      estimatedCents: 0,
      estimatedForPricedCents: 0,
      actualCents: 0,
      differenceCents: null,
      itemsWithActual: 0,
    });
  });

  it('sums estimates treating null as 0', () => {
    const t = computeTotals([
      { costEstimateCents: 100, actualCostCents: null },
      { costEstimateCents: null, actualCostCents: null },
      { costEstimateCents: 250, actualCostCents: null },
    ]);
    expect(t.estimatedCents).toBe(350);
    expect(t.actualCents).toBe(0);
    expect(t.differenceCents).toBeNull();
    expect(t.estimatedForPricedCents).toBe(0);
    expect(t.itemsWithActual).toBe(0);
  });

  it('computes difference only over items with an actual', () => {
    const t = computeTotals([
      { costEstimateCents: 100, actualCostCents: 130 },
      { costEstimateCents: 500, actualCostCents: null },
      { costEstimateCents: null, actualCostCents: 40 },
    ]);
    expect(t.estimatedCents).toBe(600);
    expect(t.actualCents).toBe(170);
    expect(t.differenceCents).toBe(70);
    expect(t.estimatedForPricedCents).toBe(100);
    expect(t.itemsWithActual).toBe(2);
  });

  it('exposes the estimate basis behind the difference (all vs priced items)', () => {
    // Estimated 900.00 overall, but only 3 items priced: 585.00 actual
    // against 600.00 estimated for those same items => 15.00 under.
    const t = computeTotals([
      { costEstimateCents: 25000, actualCostCents: 24000 },
      { costEstimateCents: 20000, actualCostCents: 19500 },
      { costEstimateCents: 15000, actualCostCents: 15000 },
      { costEstimateCents: 30000, actualCostCents: null },
    ]);
    expect(t.estimatedCents).toBe(90000);
    expect(t.estimatedForPricedCents).toBe(60000);
    expect(t.actualCents).toBe(58500);
    expect(t.differenceCents).toBe(-1500);
    expect(t.itemsWithActual).toBe(3);
  });

  it('counts an actual of 0 as an actual', () => {
    const t = computeTotals([{ costEstimateCents: 200, actualCostCents: 0 }]);
    expect(t.actualCents).toBe(0);
    expect(t.differenceCents).toBe(-200);
    expect(t.itemsWithActual).toBe(1);
  });
});
