import { describe, expect, it } from 'vitest';
import { computeTotals } from './totals';

describe('computeTotals', () => {
  it('returns zeros for empty list', () => {
    expect(computeTotals([])).toEqual({
      estimatedCents: 0,
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
    expect(t.itemsWithActual).toBe(2);
  });

  it('counts an actual of 0 as an actual', () => {
    const t = computeTotals([{ costEstimateCents: 200, actualCostCents: 0 }]);
    expect(t.actualCents).toBe(0);
    expect(t.differenceCents).toBe(-200);
    expect(t.itemsWithActual).toBe(1);
  });
});
