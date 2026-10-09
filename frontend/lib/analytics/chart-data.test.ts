import { describe, expect, it } from 'vitest';
import {
  toCategoryChartPoints,
  toTrendChartPoints,
  toWeeklyComparisonPoints,
} from './chart-data';

// Shape copied from backend AnalyticsService.getSpendingTrends().trends
const trends = [
  { date: '2026-W33', totalSpentCents: 120050, transactionCount: 2 },
  { date: '2026-W34', totalSpentCents: 90000, transactionCount: 1 },
];

describe('toTrendChartPoints', () => {
  it('maps backend trends to major-unit points with readable labels', () => {
    const points = toTrendChartPoints(trends);
    expect(points).toEqual([
      { label: 'Aug 10', fullLabel: 'Aug 10 - 16', spent: 1200.5, budget: null, transactions: 2 },
      { label: 'Aug 17', fullLabel: 'Aug 17 - 23', spent: 900, budget: null, transactions: 1 },
    ]);
  });

  it('carries the budget when present', () => {
    const [p] = toTrendChartPoints([{ ...trends[0], budgetCents: 150000 }]);
    expect(p.budget).toBe(1500);
  });

  it('is robust to empty and malformed input', () => {
    expect(toTrendChartPoints([])).toEqual([]);
    expect(toTrendChartPoints(undefined)).toEqual([]);
    expect(toTrendChartPoints({ trends: [] })).toEqual([]);
    const points = toTrendChartPoints([null, 'x', { date: 'garbage', totalSpentCents: 'NaN' }, 5]);
    expect(points).toEqual([
      { label: '—', fullLabel: '—', spent: 0, budget: null, transactions: 0 },
    ]);
  });
});

describe('toWeeklyComparisonPoints', () => {
  it('keeps the latest weeks in chronological order and computes savings', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      date: `2026-W${String(i + 20).padStart(2, '0')}`,
      totalSpentCents: (i + 1) * 100,
      transactionCount: 1,
      budgetCents: 5000,
    }));
    const points = toWeeklyComparisonPoints(many, 8);
    expect(points).toHaveLength(8);
    expect(points[0].spent).toBe(5);
    expect(points[7].spent).toBe(12);
    expect(points[7].savings).toBe((5000 - 1200) / 100);
  });

  it('uses zero budget/savings when there is no budget, and handles empty input', () => {
    expect(toWeeklyComparisonPoints(trends)[0]).toMatchObject({ budget: 0, savings: 0 });
    expect(toWeeklyComparisonPoints([])).toEqual([]);
    expect(toWeeklyComparisonPoints(null)).toEqual([]);
  });
});

describe('toCategoryChartPoints', () => {
  it('maps backend categories', () => {
    expect(
      toCategoryChartPoints([
        { category: 'dairy', totalSpentCents: 25050, itemCount: 4, percentage: 41.25 },
      ])
    ).toEqual([{ name: 'Dairy', value: 250.5, percentage: 41.25, count: 4 }]);
  });

  it('survives missing fields and limits the list', () => {
    const pts = toCategoryChartPoints([{}, null, { category: 7, percentage: 'x' }]);
    expect(pts).toEqual([
      { name: 'Uncategorized', value: 0, percentage: 0, count: 0 },
      { name: 'Uncategorized', value: 0, percentage: 0, count: 0 },
    ]);
    const big = Array.from({ length: 20 }, (_, i) => ({ category: `c${i}`, totalSpentCents: 1 }));
    expect(toCategoryChartPoints(big, 8)).toHaveLength(8);
    expect(toCategoryChartPoints([])).toEqual([]);
    expect(toCategoryChartPoints(undefined)).toEqual([]);
  });
});
