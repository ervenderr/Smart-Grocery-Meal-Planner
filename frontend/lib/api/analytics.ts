import { apiClient } from './client';
import type {
  AnalyticsDashboard,
  BudgetStatus,
  BudgetComparison,
  SpendingTrend,
  CategorySpending,
  TopItem,
  PriceTrend,
  SavingsInsight,
  SpendingTrendsParams,
  CategoryBreakdownParams,
  TopItemsParams,
  BudgetComparisonParams,
} from '@/types/budget.types';

export const analyticsApi = {
  /**
   * Get complete analytics dashboard
   */
  async getDashboard(days: number = 30): Promise<AnalyticsDashboard> {
    return await apiClient.get<AnalyticsDashboard>(`/api/v1/analytics/dashboard?days=${days}`);
  },

  /**
   * Get current budget status
   */
  async getBudgetStatus(): Promise<BudgetStatus> {
    return await apiClient.get<BudgetStatus>('/api/v1/alerts/budget/status');
  },

  /**
   * Get spending trends
   */
  async getSpendingTrends(params?: SpendingTrendsParams): Promise<SpendingTrend[]> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
    }
    const query = searchParams.toString();
    const url = query ? `/api/v1/analytics/spending-trends?${query}` : '/api/v1/analytics/spending-trends';
    return await apiClient.get<SpendingTrend[]>(url);
  },

  /**
   * Get category breakdown
   */
  async getCategoryBreakdown(params?: CategoryBreakdownParams): Promise<CategorySpending[]> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
    }
    const query = searchParams.toString();
    const url = query ? `/api/v1/analytics/category-breakdown?${query}` : '/api/v1/analytics/category-breakdown';
    return await apiClient.get<CategorySpending[]>(url);
  },

  /**
   * Get top items
   */
  async getTopItems(params?: TopItemsParams): Promise<TopItem[]> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
    }
    const query = searchParams.toString();
    const url = query ? `/api/v1/analytics/top-items?${query}` : '/api/v1/analytics/top-items';
    return await apiClient.get<TopItem[]>(url);
  },

  /**
   * Get budget comparison
   */
  async getBudgetComparison(params?: BudgetComparisonParams): Promise<BudgetComparison[]> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
    }
    const query = searchParams.toString();
    const url = query ? `/api/v1/analytics/budget-comparison?${query}` : '/api/v1/analytics/budget-comparison';
    return await apiClient.get<BudgetComparison[]>(url);
  },

  /**
   * Get price trends
   */
  async getPriceTrends(): Promise<PriceTrend[]> {
    return await apiClient.get<PriceTrend[]>('/api/v1/analytics/price-trends');
  },

  /**
   * Get savings insights
   */
  async getSavingsInsights(): Promise<SavingsInsight[]> {
    return await apiClient.get<SavingsInsight[]>('/api/v1/analytics/savings-insights');
  },
};
