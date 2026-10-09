import { describe, expect, it } from 'vitest';
import { normalizeDashboard, unwrapList } from './normalize';

describe('unwrapList', () => {
  it('unwraps the object envelopes the backend sends', () => {
    expect(unwrapList({ categories: [{ category: 'dairy' }] }, 'categories')).toEqual([{ category: 'dairy' }]);
  });

  it('passes arrays through and falls back to []', () => {
    expect(unwrapList([1, 2], 'x')).toEqual([1, 2]);
    expect(unwrapList(null, 'x')).toEqual([]);
    expect(unwrapList({ x: 'nope' }, 'x')).toEqual([]);
    expect(unwrapList({}, 'x')).toEqual([]);
  });
});

describe('normalizeDashboard', () => {
  // Shape copied from backend AnalyticsService.getDashboard.
  const real = {
    summary: {
      totalSpentCents: 350000,
      averageWeeklySpentCents: 175000,
      totalTransactions: 3,
      uniqueItemsPurchased: 0,
      topCategories: [],
      budgetUtilization: 30,
    },
    recentTrends: [{ date: '2026-03-09', totalSpentCents: 150000, transactionCount: 1 }],
    topCategories: [{ category: 'dairy', totalSpentCents: 1000, itemCount: 2, percentage: 50 }],
    topItems: [],
    budgetStatus: {
      period: 'x',
      budgetCents: 500000,
      actualSpentCents: 150000,
      differenceCents: 350000,
      percentageUsed: 30,
      status: 'under_budget',
    },
    savingsInsights: [],
  };

  it('keeps the real backend keys', () => {
    const result = normalizeDashboard(real);
    expect(result.summary?.totalSpentCents).toBe(350000);
    expect(result.topCategories).toHaveLength(1);
    expect(result.budgetStatus?.budgetCents).toBe(500000);
  });

  it('defaults every collection and nulls a missing budgetStatus', () => {
    const result = normalizeDashboard({ summary: null });
    expect(result.recentTrends).toEqual([]);
    expect(result.topCategories).toEqual([]);
    expect(result.topItems).toEqual([]);
    expect(result.savingsInsights).toEqual([]);
    expect(result.budgetStatus).toBeNull();
    expect(result.summary).toBeNull();
  });

  it('survives a non-object payload', () => {
    expect(normalizeDashboard(undefined).topCategories).toEqual([]);
  });
});
