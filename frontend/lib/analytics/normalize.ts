import type {
  AnalyticsDashboard,
  AnalyticsSummary,
  BudgetComparison,
  CategorySpending,
  SavingsInsight,
  SpendingTrend,
  TopItem,
} from '@/types/budget.types';

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

/**
 * Backend analytics endpoints wrap their lists in an envelope
 * (e.g. `{ categories: [...] }`). Return the list, tolerating a bare array
 * or a malformed payload.
 */
export function unwrapList<T = unknown>(payload: unknown, key: string): T[] {
  if (Array.isArray(payload)) return payload as T[];
  const inner = asRecord(payload)[key];
  return Array.isArray(inner) ? (inner as T[]) : [];
}

/** Defensive normalisation of `GET /analytics/dashboard`. */
export function normalizeDashboard(payload: unknown): AnalyticsDashboard {
  const raw = asRecord(payload);
  const summary = raw.summary;
  const budget = raw.budgetStatus;
  return {
    summary:
      typeof summary === 'object' && summary !== null ? (summary as AnalyticsSummary) : null,
    recentTrends: unwrapList<SpendingTrend>(raw.recentTrends, ''),
    topCategories: unwrapList<CategorySpending>(raw.topCategories, ''),
    topItems: unwrapList<TopItem>(raw.topItems, ''),
    budgetStatus:
      typeof budget === 'object' && budget !== null ? (budget as BudgetComparison) : null,
    savingsInsights: unwrapList<SavingsInsight>(raw.savingsInsights, ''),
  };
}
