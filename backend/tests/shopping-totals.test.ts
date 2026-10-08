import { computeHistoryTotals } from '../src/modules/shopping/shopping.totals';

const item = (isChecked: boolean, actual: number | null, est: number | null) => ({
  isChecked,
  actualCostCents: actual,
  costEstimateCents: est,
});

describe('computeHistoryTotals', () => {
  it('counts only checked items, actual falling back to estimate', () => {
    const r = computeHistoryTotals([item(true, 500, 400), item(true, null, 300), item(false, 900, 900)]);
    expect(r).toEqual({ totalCents: 800, estimatedCents: 700, itemCount: 3, checkedCount: 2 });
  });

  it('treats missing prices as 0 and an actual of 0 as 0', () => {
    const r = computeHistoryTotals([item(true, null, null), item(true, 0, 250)]);
    expect(r.totalCents).toBe(0);
    expect(r.estimatedCents).toBe(250);
  });

  it('clamps to the int4 maximum', () => {
    const items = Array.from({ length: 300 }, () => item(true, 200_000_000, 200_000_000));
    const r = computeHistoryTotals(items);
    expect(r.totalCents).toBe(2_000_000_000);
    expect(r.estimatedCents).toBe(2_000_000_000);
  });

  it('returns zeros for an empty list', () => {
    expect(computeHistoryTotals([])).toEqual({
      totalCents: 0,
      estimatedCents: 0,
      itemCount: 0,
      checkedCount: 0,
    });
  });
});
