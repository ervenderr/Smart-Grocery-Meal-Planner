/**
 * Analytics Types
 *
 * TypeScript type definitions for analytics and reporting.
 */

export interface SpendingTrend {
  date: string;
  totalSpentCents: number;
  transactionCount: number;
}

export interface CategorySpending {
  category: string;
  totalSpentCents: number;
  itemCount: number;
  percentage: number;
}

export interface TopItem {
  ingredientName: string;
  totalQuantity: number;
  totalSpentCents: number;
  purchaseCount: number;
  averagePriceCents: number;
}

export interface BudgetComparison {
  period: string;
  budgetCents: number;
  actualSpentCents: number;
  differenceCents: number;
  percentageUsed: number;
  status: 'under_budget' | 'on_budget' | 'over_budget';
}

export interface PriceTrend {
  ingredientName: string;
  trends: Array<{
    date: string;
    averagePriceCents: number;
  }>;
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

export interface SpendingTrendsQuery {
  period: 'daily' | 'weekly' | 'monthly';
  startDate?: string;
  endDate?: string;
  limit?: number;
}

export interface CategoryBreakdownQuery {
  startDate?: string;
  endDate?: string;
  minAmount?: number;
}

export interface TopItemsQuery {
  startDate?: string;
  endDate?: string;
  limit?: number;
  sortBy?: 'quantity' | 'spending' | 'frequency';
}

export interface BudgetComparisonQuery {
  period: 'weekly' | 'monthly' | 'yearly';
  count?: number;
}

export interface PriceTrendsQuery {
  ingredientName?: string;
  startDate?: string;
  endDate?: string;
  period?: 'daily' | 'weekly' | 'monthly';
}

export interface SpendingTrendsResponse {
  period: string;
  trends: SpendingTrend[];
  summary: {
    totalSpentCents: number;
    averagePerPeriodCents: number;
    highestSpendingDate: string;
    lowestSpendingDate: string;
  };
}

export interface CategoryBreakdownResponse {
  categories: CategorySpending[];
  totalSpentCents: number;
  dateRange: {
    startDate: string;
    endDate: string;
  };
}

export interface TopItemsResponse {
  items: TopItem[];
  dateRange: {
    startDate: string;
    endDate: string;
  };
}

export interface BudgetComparisonResponse {
  comparisons: BudgetComparison[];
  summary: {
    averageUtilization: number;
    periodsOverBudget: number;
    totalPeriodsAnalyzed: number;
  };
}

export interface PriceTrendsResponse {
  ingredients: PriceTrend[];
  dateRange: {
    startDate: string;
    endDate: string;
  };
}

export interface SavingsInsightsResponse {
  insights: SavingsInsight[];
  totalSavingsCents: number;
  dateRange: {
    startDate: string;
    endDate: string;
  };
}

export interface AnalyticsDashboardResponse {
  summary: AnalyticsSummary;
  recentTrends: SpendingTrend[];
  topCategories: CategorySpending[];
  topItems: TopItem[];
  budgetStatus: BudgetComparison;
  savingsInsights: SavingsInsight[];
}
