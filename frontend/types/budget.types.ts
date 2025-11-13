/**
 * Budget & Analytics Types
 */

export interface BudgetStatus {
  weeklyBudgetCents: number;
  spentThisWeekCents: number;
  remainingCents: number;
  percentageUsed: number;
  status: 'healthy' | 'warning' | 'exceeded';
  weekStart: string;
  weekEnd: string;
}

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
  period: string;
  totalSpentCents: number;
  itemCount: number;
  averagePerItem: number;
}

export interface TopItem {
  itemName: string;
  totalSpentCents?: number;
  totalQuantity?: number;
  frequency?: number;
  averagePriceCents?: number;
}

export interface PriceTrend {
  ingredientName: string;
  averagePriceCents: number;
  trend: 'up' | 'down' | 'stable';
  changePercentage: number;
}

export interface SavingsInsight {
  type: 'price_drop' | 'budget_savings' | 'bulk_savings' | 'seasonal';
  title: string;
  description: string;
  amountSavedCents: number;
}

export interface AnalyticsDashboard {
  budgetStatus: BudgetStatus;
  spendingTrends: SpendingTrend[];
  categoryBreakdown: CategorySpending[];
  topItems: TopItem[];
  savingsInsights: SavingsInsight[];
  totalSpentCents: number;
  averageWeeklySpendingCents: number;
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
