/**
 * Analytics Service
 *
 * Business logic for analytics and reporting.
 */

import { prisma } from '../../config/database.config';
import { AppError } from '../../middleware/errorHandler';
import {
  SpendingTrendsQuery,
  SpendingTrendsResponse,
  CategoryBreakdownQuery,
  CategoryBreakdownResponse,
  TopItemsQuery,
  TopItemsResponse,
  BudgetComparisonQuery,
  BudgetComparisonResponse,
  PriceTrendsQuery,
  PriceTrendsResponse,
  SavingsInsightsResponse,
  AnalyticsDashboardResponse,
  SpendingTrend,
  CategorySpending,
  TopItem,
  BudgetComparison,
  PriceTrend,
  SavingsInsight,
} from '../../types/analytics.types';

export class AnalyticsService {
  /**
   * Get spending trends over time
   */
  async getSpendingTrends(
    userId: string,
    query: SpendingTrendsQuery
  ): Promise<SpendingTrendsResponse> {
    const { period = 'weekly', limit = 12 } = query;

    // Calculate date range
    const endDate = query.endDate ? new Date(query.endDate) : new Date();
    const startDate = query.startDate
      ? new Date(query.startDate)
      : this.calculateStartDate(endDate, period, limit);

    // Get shopping history
    const history = await prisma.shoppingHistory.findMany({
      where: {
        userId,
        receiptDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { receiptDate: 'asc' },
    });

    // Group by period
    const trends = this.groupByPeriod(history, period);

    // Calculate summary
    const totalSpent = trends.reduce((sum, t) => sum + t.totalSpentCents, 0);
    const avgPerPeriod = trends.length > 0 ? Math.round(totalSpent / trends.length) : 0;

    const sortedTrends = [...trends].sort((a, b) => b.totalSpentCents - a.totalSpentCents);
    const highestSpending = sortedTrends[0];
    const lowestSpending = sortedTrends[sortedTrends.length - 1];

    return {
      period,
      trends,
      summary: {
        totalSpentCents: totalSpent,
        averagePerPeriodCents: avgPerPeriod,
        highestSpendingDate: highestSpending?.date || '',
        lowestSpendingDate: lowestSpending?.date || '',
      },
    };
  }

  /**
   * Get category breakdown
   */
  async getCategoryBreakdown(
    userId: string,
    query: CategoryBreakdownQuery
  ): Promise<CategoryBreakdownResponse> {
    const endDate = query.endDate ? new Date(query.endDate) : new Date();
    const startDate = query.startDate
      ? new Date(query.startDate)
      : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // Default: 30 days

    // Get pantry items purchased in the period
    const pantryItems = await prisma.pantryItem.findMany({
      where: {
        userId,
        purchaseDate: {
          gte: startDate,
          lte: endDate,
        },
        purchasePriceCents: { not: null },
      },
    });

    // Group by category
    const categoryMap = new Map<string, { totalCents: number; count: number }>();
    let totalSpent = 0;

    pantryItems.forEach((item) => {
      if (!item.purchasePriceCents) return;

      const existing = categoryMap.get(item.category) || { totalCents: 0, count: 0 };
      existing.totalCents += item.purchasePriceCents;
      existing.count += 1;
      categoryMap.set(item.category, existing);

      totalSpent += item.purchasePriceCents;
    });

    // Convert to array with percentages
    const categories: CategorySpending[] = Array.from(categoryMap.entries())
      .map(([category, data]) => ({
        category,
        totalSpentCents: data.totalCents,
        itemCount: data.count,
        percentage: totalSpent > 0 ? (data.totalCents / totalSpent) * 100 : 0,
      }))
      .filter((c) => !query.minAmount || c.totalSpentCents >= query.minAmount)
      .sort((a, b) => b.totalSpentCents - a.totalSpentCents);

    return {
      categories,
      totalSpentCents: totalSpent,
      dateRange: {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      },
    };
  }

  /**
   * Get top items by spending, quantity, or frequency
   */
  async getTopItems(
    userId: string,
    query: TopItemsQuery
  ): Promise<TopItemsResponse> {
    const { limit = 10, sortBy = 'spending' } = query;
    const endDate = query.endDate ? new Date(query.endDate) : new Date();
    const startDate = query.startDate
      ? new Date(query.startDate)
      : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get pantry items
    const pantryItems = await prisma.pantryItem.findMany({
      where: {
        userId,
        purchaseDate: {
          gte: startDate,
          lte: endDate,
        },
        purchasePriceCents: { not: null },
      },
    });

    // Group by ingredient name
    const itemMap = new Map<string, { qty: number; spent: number; count: number }>();

    pantryItems.forEach((item) => {
      if (!item.purchasePriceCents) return;

      const existing = itemMap.get(item.ingredientName) || { qty: 0, spent: 0, count: 0 };
      existing.qty += Number(item.quantity);
      existing.spent += item.purchasePriceCents;
      existing.count += 1;
      itemMap.set(item.ingredientName, existing);
    });

    // Convert to array
    let items: TopItem[] = Array.from(itemMap.entries()).map(([name, data]) => ({
      ingredientName: name,
      totalQuantity: Math.round(data.qty * 100) / 100,
      totalSpentCents: data.spent,
      purchaseCount: data.count,
      averagePriceCents: Math.round(data.spent / data.count),
    }));

    // Sort based on criteria
    if (sortBy === 'quantity') {
      items.sort((a, b) => b.totalQuantity - a.totalQuantity);
    } else if (sortBy === 'frequency') {
      items.sort((a, b) => b.purchaseCount - a.purchaseCount);
    } else {
      items.sort((a, b) => b.totalSpentCents - a.totalSpentCents);
    }

    items = items.slice(0, limit);

    return {
      items,
      dateRange: {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      },
    };
  }

  /**
   * Get budget comparison over periods
   */
  async getBudgetComparison(
    userId: string,
    query: BudgetComparisonQuery
  ): Promise<BudgetComparisonResponse> {
    const { period = 'weekly', count = 4 } = query;

    // Get user preferences
    const preferences = await prisma.userPreference.findUnique({
      where: { userId },
    });

    if (!preferences) {
      throw new AppError('User preferences not found', 404);
    }

    const budgetPerPeriod = period === 'weekly'
      ? preferences.budgetPerWeekCents
      : period === 'monthly'
      ? preferences.budgetPerWeekCents * 4
      : preferences.budgetPerWeekCents * 52;

    // Generate periods
    const comparisons: BudgetComparison[] = [];
    const now = new Date();

    for (let i = 0; i < count; i++) {
      const { start, end, label } = this.getPeriodBounds(now, period, i);

      // Get spending for this period
      const history = await prisma.shoppingHistory.findMany({
        where: {
          userId,
          receiptDate: { gte: start, lte: end },
        },
      });

      const actualSpent = history.reduce((sum, h) => sum + h.totalPhpCents, 0);
      const difference = budgetPerPeriod - actualSpent;
      const percentageUsed = (actualSpent / budgetPerPeriod) * 100;

      let status: 'under_budget' | 'on_budget' | 'over_budget';
      if (percentageUsed < 95) {
        status = 'under_budget';
      } else if (percentageUsed <= 105) {
        status = 'on_budget';
      } else {
        status = 'over_budget';
      }

      comparisons.push({
        period: label,
        budgetCents: budgetPerPeriod,
        actualSpentCents: actualSpent,
        differenceCents: difference,
        percentageUsed: Math.round(percentageUsed * 100) / 100,
        status,
      });
    }

    // Calculate summary
    const avgUtilization = comparisons.reduce((sum, c) => sum + c.percentageUsed, 0) / comparisons.length;
    const periodsOverBudget = comparisons.filter((c) => c.status === 'over_budget').length;

    return {
      comparisons,
      summary: {
        averageUtilization: Math.round(avgUtilization * 100) / 100,
        periodsOverBudget,
        totalPeriodsAnalyzed: comparisons.length,
      },
    };
  }

  /**
   * Get price trends for ingredients
   */
  async getPriceTrends(
    userId: string,
    query: PriceTrendsQuery
  ): Promise<PriceTrendsResponse> {
    const { period = 'weekly' } = query;
    const endDate = query.endDate ? new Date(query.endDate) : new Date();
    const startDate = query.startDate
      ? new Date(query.startDate)
      : new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000); // Default: 90 days

    // Get pantry items with prices
    let pantryItems = await prisma.pantryItem.findMany({
      where: {
        userId,
        purchaseDate: {
          gte: startDate,
          lte: endDate,
        },
        purchasePriceCents: { not: null },
        ...(query.ingredientName && { ingredientName: query.ingredientName }),
      },
      orderBy: { purchaseDate: 'asc' },
    });

    // Group by ingredient and period
    const trendMap = new Map<string, Map<string, { total: number; count: number }>>();

    pantryItems.forEach((item) => {
      if (!item.purchaseDate || !item.purchasePriceCents) return;

      const periodKey = this.getPeriodKey(item.purchaseDate, period);

      if (!trendMap.has(item.ingredientName)) {
        trendMap.set(item.ingredientName, new Map());
      }

      const ingredientTrends = trendMap.get(item.ingredientName)!;
      const existing = ingredientTrends.get(periodKey) || { total: 0, count: 0 };
      existing.total += item.purchasePriceCents;
      existing.count += 1;
      ingredientTrends.set(periodKey, existing);
    });

    // Convert to response format
    const ingredients: PriceTrend[] = Array.from(trendMap.entries()).map(([name, periods]) => {
      const trends = Array.from(periods.entries())
        .map(([date, data]) => ({
          date,
          averagePriceCents: Math.round(data.total / data.count),
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      let overallChange = 0;
      let overallChangePercentage = 0;

      if (trends.length >= 2) {
        const firstPrice = trends[0].averagePriceCents;
        const lastPrice = trends[trends.length - 1].averagePriceCents;
        overallChange = lastPrice - firstPrice;
        overallChangePercentage = (overallChange / firstPrice) * 100;
      }

      return {
        ingredientName: name,
        trends,
        overallChange: Math.round(overallChange),
        overallChangePercentage: Math.round(overallChangePercentage * 100) / 100,
      };
    });

    return {
      ingredients,
      dateRange: {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      },
    };
  }

  /**
   * Get savings insights
   */
  async getSavingsInsights(userId: string): Promise<SavingsInsightsResponse> {
    const insights: SavingsInsight[] = [];
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get user preferences and budget status
    const preferences = await prisma.userPreference.findUnique({
      where: { userId },
    });

    if (!preferences) {
      throw new AppError('User preferences not found', 404);
    }

    // Calculate budget savings
    const history = await prisma.shoppingHistory.findMany({
      where: {
        userId,
        receiptDate: { gte: startDate, lte: endDate },
      },
    });

    const totalSpent = history.reduce((sum, h) => sum + h.totalPhpCents, 0);
    const weeklyBudget = preferences.budgetPerWeekCents;
    const monthlyBudget = weeklyBudget * 4;

    if (totalSpent < monthlyBudget) {
      insights.push({
        type: 'budget_savings',
        title: 'Under Budget This Month',
        description: `You're ${Math.round(((monthlyBudget - totalSpent) / monthlyBudget) * 100)}% under your monthly budget`,
        amountSavedCents: monthlyBudget - totalSpent,
      });
    }

    // Price drop detection
    const priceTrends = await this.getPriceTrends(userId, { period: 'weekly' });
    priceTrends.ingredients.forEach((trend) => {
      if (trend.overallChange < -50 && trend.trends.length >= 2) {
        insights.push({
          type: 'price_drop',
          title: `${trend.ingredientName} Price Decreased`,
          description: `Price dropped by ${Math.abs(Math.round(trend.overallChangePercentage))}% recently`,
          amountSavedCents: Math.abs(trend.overallChange),
          ingredientName: trend.ingredientName,
        });
      }
    });

    const totalSavings = insights.reduce((sum, i) => sum + i.amountSavedCents, 0);

    return {
      insights,
      totalSavingsCents: totalSavings,
      dateRange: {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      },
    };
  }

  /**
   * Get analytics dashboard with summary
   */
  async getDashboard(userId: string): Promise<AnalyticsDashboardResponse> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get spending trends
    const trendsData = await this.getSpendingTrends(userId, { period: 'weekly', limit: 4 });

    // Get category breakdown
    const categoryData = await this.getCategoryBreakdown(userId, {});

    // Get top items
    const topItemsData = await this.getTopItems(userId, { limit: 5 });

    // Get budget comparison
    const budgetData = await this.getBudgetComparison(userId, { period: 'weekly', count: 1 });

    // Get savings insights
    const savingsData = await this.getSavingsInsights(userId);

    // Calculate summary
    const uniqueItems = new Set(
      (await prisma.pantryItem.findMany({
        where: { userId, purchaseDate: { gte: startDate, lte: endDate } },
        select: { ingredientName: true },
      })).map((i) => i.ingredientName)
    ).size;

    const summary = {
      totalSpentCents: trendsData.summary.totalSpentCents,
      averageWeeklySpentCents: trendsData.summary.averagePerPeriodCents,
      totalTransactions: trendsData.trends.reduce((sum, t) => sum + t.transactionCount, 0),
      uniqueItemsPurchased: uniqueItems,
      topCategories: categoryData.categories.slice(0, 5),
      budgetUtilization: budgetData.comparisons[0]?.percentageUsed || 0,
    };

    return {
      summary,
      recentTrends: trendsData.trends,
      topCategories: categoryData.categories.slice(0, 5),
      topItems: topItemsData.items,
      budgetStatus: budgetData.comparisons[0],
      savingsInsights: savingsData.insights.slice(0, 3),
    };
  }

  /**
   * Helper: Calculate start date based on period and limit
   */
  private calculateStartDate(endDate: Date, period: string, limit: number): Date {
    const daysPerPeriod = period === 'daily' ? 1 : period === 'weekly' ? 7 : 30;
    const totalDays = daysPerPeriod * limit;
    return new Date(endDate.getTime() - totalDays * 24 * 60 * 60 * 1000);
  }

  /**
   * Helper: Group shopping history by period
   */
  private groupByPeriod(history: any[], period: string): SpendingTrend[] {
    const groupMap = new Map<string, { total: number; count: number }>();

    history.forEach((item) => {
      const key = this.getPeriodKey(item.receiptDate, period);
      const existing = groupMap.get(key) || { total: 0, count: 0 };
      existing.total += item.totalPhpCents;
      existing.count += 1;
      groupMap.set(key, existing);
    });

    return Array.from(groupMap.entries())
      .map(([date, data]) => ({
        date,
        totalSpentCents: data.total,
        transactionCount: data.count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Helper: Get period key for grouping
   */
  private getPeriodKey(date: Date, period: string): string {
    if (period === 'daily') {
      return date.toISOString().split('T')[0];
    } else if (period === 'weekly') {
      const year = date.getFullYear();
      const week = this.getWeekNumber(date);
      return `${year}-W${String(week).padStart(2, '0')}`;
    } else {
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      return `${year}-${String(month).padStart(2, '0')}`;
    }
  }

  /**
   * Helper: Get week number
   */
  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  /**
   * Helper: Get period bounds
   */
  private getPeriodBounds(
    now: Date,
    period: string,
    offset: number
  ): { start: Date; end: Date; label: string } {
    const start = new Date(now);
    const end = new Date(now);

    if (period === 'weekly') {
      const dayOfWeek = start.getDay();
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      start.setDate(start.getDate() + diffToMonday - offset * 7);
      start.setHours(0, 0, 0, 0);

      end.setTime(start.getTime());
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);

      return {
        start,
        end,
        label: `Week of ${start.toISOString().split('T')[0]}`,
      };
    } else if (period === 'monthly') {
      start.setMonth(start.getMonth() - offset);
      start.setDate(1);
      start.setHours(0, 0, 0, 0);

      end.setTime(start.getTime());
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);

      return {
        start,
        end,
        label: start.toLocaleDateString('en-US', { year: 'numeric', month: 'long' }),
      };
    } else {
      // yearly
      start.setFullYear(start.getFullYear() - offset);
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);

      end.setTime(start.getTime());
      end.setMonth(11, 31);
      end.setHours(23, 59, 59, 999);

      return {
        start,
        end,
        label: String(start.getFullYear()),
      };
    }
  }
}
