import { describe, expect, it } from 'vitest';
import {
  budgetFromAlertStatus,
  budgetFromComparison,
  formatPercent,
  getBudgetHealth,
} from './budget';

describe('getBudgetHealth', () => {
  it('returns null when the percentage is unusable', () => {
    expect(getBudgetHealth(null)).toBeNull();
    expect(getBudgetHealth(undefined)).toBeNull();
    expect(getBudgetHealth(Number.NaN)).toBeNull();
    expect(getBudgetHealth(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('uses the backend defaults: warning at 90, exceeded at 100', () => {
    expect(getBudgetHealth(0)).toBe('healthy');
    expect(getBudgetHealth(89.99)).toBe('healthy');
    expect(getBudgetHealth(90)).toBe('warning');
    expect(getBudgetHealth(99.99)).toBe('warning');
    expect(getBudgetHealth(100)).toBe('exceeded');
    expect(getBudgetHealth(250)).toBe('exceeded');
  });

  it('honours a custom warning threshold', () => {
    expect(getBudgetHealth(75, 75)).toBe('warning');
    expect(getBudgetHealth(74, 75)).toBe('healthy');
  });
});

describe('formatPercent', () => {
  it('rounds valid values and returns N/A otherwise', () => {
    expect(formatPercent(37.4)).toBe('37%');
    expect(formatPercent(0)).toBe('0%');
    expect(formatPercent(null)).toBe('N/A');
    expect(formatPercent(undefined)).toBe('N/A');
    expect(formatPercent(Number.NaN)).toBe('N/A');
  });
});

describe('budgetFromComparison', () => {
  // Shape copied from backend AnalyticsService.getBudgetComparison.
  const real = {
    period: 'Mar 9 - Mar 15',
    budgetCents: 500000,
    actualSpentCents: 150000,
    differenceCents: 350000,
    percentageUsed: 30,
    status: 'under_budget',
  };

  it('maps the real backend shape', () => {
    expect(budgetFromComparison(real)).toEqual({
      budgetCents: 500000,
      spentCents: 150000,
      remainingCents: 350000,
      percentageUsed: 30,
      status: 'healthy',
    });
  });

  it('reports a negative remaining amount and exceeded status when over budget', () => {
    const over = { ...real, actualSpentCents: 600000, differenceCents: -100000, percentageUsed: 120 };
    expect(budgetFromComparison(over)).toMatchObject({
      remainingCents: -100000,
      status: 'exceeded',
    });
  });

  it('returns null for missing data', () => {
    expect(budgetFromComparison(null)).toBeNull();
    expect(budgetFromComparison(undefined)).toBeNull();
    expect(budgetFromComparison({})).toBeNull();
  });

  it('returns null for a zero budget (backend sends percentageUsed null/Infinity)', () => {
    expect(
      budgetFromComparison({ ...real, budgetCents: 0, actualSpentCents: 0, differenceCents: 0, percentageUsed: null }),
    ).toBeNull();
  });

  it('derives percentage and remaining when only the base amounts are present', () => {
    expect(budgetFromComparison({ budgetCents: 1000, actualSpentCents: 250 })).toEqual({
      budgetCents: 1000,
      spentCents: 250,
      remainingCents: 750,
      percentageUsed: 25,
      status: 'healthy',
    });
  });

  it('ignores NaN percentageUsed and recomputes it', () => {
    expect(
      budgetFromComparison({ ...real, percentageUsed: Number.NaN })?.percentageUsed,
    ).toBe(30);
  });
});

describe('budgetFromAlertStatus', () => {
  // Shape copied from backend AlertService.getBudgetStatus.
  const real = {
    weeklyBudgetCents: 10000,
    spentThisWeekCents: 9500,
    remainingCents: 500,
    percentageUsed: 95,
    status: 'warning',
    weekStart: '2026-03-09',
    weekEnd: '2026-03-15',
  };

  it('maps the real backend shape and keeps the server status', () => {
    expect(budgetFromAlertStatus(real)).toEqual({
      budgetCents: 10000,
      spentCents: 9500,
      remainingCents: 500,
      percentageUsed: 95,
      status: 'warning',
    });
  });

  it('derives status when the server status is missing or unknown', () => {
    expect(budgetFromAlertStatus({ ...real, status: undefined })?.status).toBe('warning');
    expect(budgetFromAlertStatus({ ...real, status: 'weird' })?.status).toBe('warning');
  });

  it('returns null for zero budget or missing data', () => {
    expect(budgetFromAlertStatus(null)).toBeNull();
    expect(budgetFromAlertStatus({ ...real, weeklyBudgetCents: 0, percentageUsed: null })).toBeNull();
  });
});
