import { describe, expect, it } from 'vitest';
import { computeTripTotal, describeDifference, differenceLabel, localIsoDate } from './trip';

const item = (isChecked: boolean, est: number | null, actual: number | null) => ({
  isChecked,
  costEstimateCents: est,
  actualCostCents: actual,
});

describe('computeTripTotal', () => {
  it('sums checked items using actual, else estimate, else 0', () => {
    const r = computeTripTotal([
      item(true, 100, 150),
      item(true, 200, null),
      item(true, null, null),
      item(false, 999, 999),
    ]);
    expect(r).toEqual({ totalCents: 350, checkedCount: 3, uncheckedCount: 1 });
  });

  it('counts an actual of 0 as 0, not the estimate', () => {
    expect(computeTripTotal([item(true, 500, 0)]).totalCents).toBe(0);
  });

  it('clamps to the backend maximum', () => {
    const r = computeTripTotal([item(true, null, 1_500_000_000), item(true, null, 1_500_000_000)]);
    expect(r.totalCents).toBe(2_000_000_000);
  });
});

describe('localIsoDate', () => {
  it('uses the local calendar date and pads', () => {
    expect(localIsoDate(new Date(2026, 9, 9, 23, 30))).toBe('2026-10-09');
    expect(localIsoDate(new Date(2026, 0, 5, 0, 5))).toBe('2026-01-05');
  });
});

describe('describeDifference', () => {
  it('maps null, under, over and even', () => {
    expect(describeDifference(null)).toEqual({ tone: 'none', amountCents: 0 });
    expect(describeDifference(-250)).toEqual({ tone: 'under', amountCents: 250 });
    expect(describeDifference(300)).toEqual({ tone: 'over', amountCents: 300 });
    expect(describeDifference(0)).toEqual({ tone: 'even', amountCents: 0 });
  });
});

describe('differenceLabel', () => {
  it('words the difference as priced items vs their own estimate', () => {
    expect(differenceLabel('under', '₱15.00')).toBe('Priced items: ₱15.00 under estimate');
    expect(differenceLabel('over', '₱15.00')).toBe('Priced items: ₱15.00 over estimate');
    expect(differenceLabel('even', '₱0.00')).toBe('Priced items: on estimate');
  });

  it('returns null when nothing is priced yet', () => {
    expect(differenceLabel('none', '₱0.00')).toBeNull();
  });
});
