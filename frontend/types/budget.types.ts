/**
 * Budget & Analytics Types
 */

export type BudgetHealth = 'healthy' | 'warning' | 'exceeded';

/** GET /alerts/budget/status */
export interface BudgetStatus {
  weeklyBudgetCents: number;
  spentThisWeekCents: number;
  remainingCents: number;
  percentageUsed: number;
  status: BudgetHealth;
  weekStart: string;
  weekEnd: string;
}

/** One entry of GET /analytics/budget-comparison (also dashboard.budgetStatus). */
export interface BudgetComparison {
  period: string;
  budgetCents: number;
  actualSpentCents: number;
  differenceCents: number;
  percentageUsed: number;
  status: 'under_budget' | 'on_budget' | 'over_budget';
}

export interface CategorySpending {
  category: string;
  totalSpentCents: number;
  itemCount: number;
  percentage: number;
}

export interface SpendingTrend {
  date: string;
  totalSpentCents: number;
  transactionCount: number;
}

export interface TopItem {
  ingredientName: string;
  totalQuantity: number;
  totalSpentCents: number;
  purchaseCount: number;
  averagePriceCents: number;
}

export interface PriceTrend {
  ingredientName: string;
  trends: Array<{ date: string; averagePriceCents: number }>;
  overallChange: number;
  overallChangePercentage: number;
}

export interface SavingsInsight {
  type: 'price_drop' | 'budget_savings' | 'bulk_savings' | 'seasonal';
  title: string;
  description: string;
  amountSavedCents: number;
  ingredientName?: string;
}

export interface AnalyticsSummary {
  totalSpentCents: number;
  averageWeeklySpentCents: number;
  totalTransactions: number;
  uniqueItemsPurchased: number;
  topCategories: CategorySpending[];
  budgetUtilization: number;
}

/** GET /analytics/dashboard (mirrors backend AnalyticsDashboardResponse). */
export interface AnalyticsDashboard {
  summary: AnalyticsSummary | null;
  recentTrends: SpendingTrend[];
  topCategories: CategorySpending[];
  topItems: TopItem[];
  /** Absent from the backend payload when no comparison period exists. */
  budgetStatus: BudgetComparison | null;
  savingsInsights: SavingsInsight[];
}

export interface Alert {
  id: string;
  userId: string;
  alertType: 'budget_exceeded' | 'budget_warning' | 'item_expiring' | 'price_spike' | 'trend_alert';
  title: string;
  message: string;
  threshold?: number;
  actualValue?: number;
  severity: 'low' | 'medium' | 'high';
  isRead: boolean;
  dismissedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AlertsResponse {
  items: Alert[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AlertStats {
  totalAlerts: number;
  unreadCount: number;
  bySeverity: Record<string, number>;
  byType: Record<string, number>;
}

export interface SpendingTrendsParams {
  period?: 'daily' | 'weekly' | 'monthly';
  startDate?: string;
  endDate?: string;
}

export interface CategoryBreakdownParams {
  startDate?: string;
  endDate?: string;
}

export interface TopItemsParams {
  metric?: 'spending' | 'quantity' | 'frequency';
  limit?: number;
  startDate?: string;
  endDate?: string;
}

export interface BudgetComparisonParams {
  startDate?: string;
  endDate?: string;
  period?: 'weekly' | 'monthly';
}
