'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Banknote, ShoppingCart, Package, UtensilsCrossed, Settings, Info } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { SpendingTrendsChart } from '@/components/analytics/spending-trends-chart';
import { CategorySpendingChart } from '@/components/analytics/category-spending-chart';
import { PantryAnalytics } from '@/components/analytics/pantry-analytics';
import { RecipeAnalytics } from '@/components/analytics/recipe-analytics';
import { WeeklyComparisonChart } from '@/components/analytics/weekly-comparison-chart';
import { analyticsApi } from '@/lib/api/analytics';
import toast from 'react-hot-toast';
import { subDays, format } from 'date-fns';
import Link from 'next/link';

type DateRange = '7d' | '30d' | '90d' | 'all';

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [budgetStatus, setBudgetStatus] = useState<any>(null);
  const [spendingTrends, setSpendingTrends] = useState<any[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalSpent: 0,
    avgWeeklySpending: 0,
    topCategory: '',
    savingsRate: 0,
  });

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      // Calculate date range
      const endDate = new Date();
      let startDate = new Date();

      switch (dateRange) {
        case '7d':
          startDate = subDays(endDate, 7);
          break;
        case '30d':
          startDate = subDays(endDate, 30);
          break;
        case '90d':
          startDate = subDays(endDate, 90);
          break;
        case 'all':
          startDate = subDays(endDate, 365); // Last year
          break;
      }

      const [budgetData, trendsData, categoryData] = await Promise.all([
        analyticsApi.getBudgetStatus().catch(() => null),
        analyticsApi.getSpendingTrends({
          startDate: format(startDate, 'yyyy-MM-dd'),
          endDate: format(endDate, 'yyyy-MM-dd'),
        }).catch(() => []),
        analyticsApi.getCategoryBreakdown().catch(() => []),
      ]);

      setBudgetStatus(budgetData);

      // Ensure trendsData and categoryData are arrays
      const safeTrendsData = Array.isArray(trendsData) ? trendsData : [];
      const safeCategoryData = Array.isArray(categoryData) ? categoryData : [];

      setSpendingTrends(safeTrendsData);
      setCategoryBreakdown(safeCategoryData);

      // Calculate stats
      const totalSpent = safeTrendsData.reduce((sum: number, item: any) => sum + (item.totalSpentCents || 0), 0);
      const avgWeekly = safeTrendsData.length > 0 ? totalSpent / safeTrendsData.length : 0;
      const topCat = safeCategoryData.length > 0 ? safeCategoryData[0].category : 'N/A';
      const savings = budgetData ? ((budgetData.remainingCents / budgetData.weeklyBudgetCents) * 100) : 0;

      setStats({
        totalSpent,
        avgWeeklySpending: avgWeekly,
        topCategory: topCat,
        savingsRate: Math.max(0, savings),
      });
    } catch (error) {
      console.error('Fetch analytics error:', error);
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return `₱${(cents / 100).toFixed(2)}`;
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Analytics</h1>
          <p className="mt-1 text-sm text-gray-600">
            Insights into your grocery spending and habits
          </p>
        </div>

        {/* Date Range Filter */}
        <div className="flex flex-wrap gap-2">
          {(['7d', '30d', '90d', 'all'] as DateRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-2.5 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-colors ${
                dateRange === range
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {range === '7d' && '7D'}
              {range === '30d' && '30D'}
              {range === '90d' && '90D'}
              {range === 'all' && 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Budget Adjustment CTA */}
      {budgetStatus && (
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-blue-100 p-2 flex-shrink-0">
              <Info className="h-4 w-4 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-blue-900">Manage Your Budget</h3>
              <p className="text-xs text-blue-700 mt-1">
                Your current weekly budget is {formatCurrency(budgetStatus.weeklyBudgetCents)}.
                Adjust your budget and preferences to better track your spending.
              </p>
              <Link href="/settings?tab=preferences">
                <Button size="sm" className="mt-3 text-xs h-8">
                  <Settings className="h-3 w-3" />
                  Adjust Budget Settings
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      )}

      {/* Overview Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Total Spent</p>
              <p className="text-lg sm:text-2xl font-bold text-gray-900 mt-1">
                {formatCurrency(stats.totalSpent)}
              </p>
              <p className="text-xs text-gray-500 mt-1 hidden sm:block">in selected period</p>
            </div>
            <div className="rounded-full bg-blue-100 p-2 sm:p-3 flex-shrink-0 ml-2">
              <Banknote className="h-4 w-4 sm:h-6 sm:w-6 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card className="p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Avg Weekly</p>
              <p className="text-lg sm:text-2xl font-bold text-gray-900 mt-1">
                {formatCurrency(stats.avgWeeklySpending)}
              </p>
              <p className="text-xs text-gray-500 mt-1 hidden sm:block">average per week</p>
            </div>
            <div className="rounded-full bg-green-100 p-2 sm:p-3 flex-shrink-0 ml-2">
              <ShoppingCart className="h-4 w-4 sm:h-6 sm:w-6 text-green-600" />
            </div>
          </div>
        </Card>

        <Card className="p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Top Category</p>
              <p className="text-lg sm:text-2xl font-bold text-gray-900 mt-1 capitalize truncate">
                {stats.topCategory}
              </p>
              <p className="text-xs text-gray-500 mt-1 hidden sm:block">most purchased</p>
            </div>
            <div className="rounded-full bg-purple-100 p-2 sm:p-3 flex-shrink-0 ml-2">
              <Package className="h-4 w-4 sm:h-6 sm:w-6 text-purple-600" />
            </div>
          </div>
        </Card>

        <Card className="p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Budget Status</p>
              <p className="text-lg sm:text-2xl font-bold text-gray-900 mt-1">
                {stats.savingsRate.toFixed(0)}%
              </p>
              <p className="text-xs text-gray-500 mt-1 hidden sm:block">remaining this week</p>
            </div>
            <div className={`rounded-full p-2 sm:p-3 flex-shrink-0 ml-2 ${
              stats.savingsRate > 20 ? 'bg-green-100' : stats.savingsRate > 10 ? 'bg-yellow-100' : 'bg-red-100'
            }`}>
              {stats.savingsRate > 20 ? (
                <TrendingDown className="h-4 w-4 sm:h-6 sm:w-6 text-green-600" />
              ) : (
                <TrendingUp className="h-4 w-4 sm:h-6 sm:w-6 text-red-600" />
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 lg:grid-cols-2">
        <SpendingTrendsChart data={spendingTrends} dateRange={dateRange} />
        <CategorySpendingChart data={categoryBreakdown} />
      </div>

      {/* Weekly Comparison */}
      <WeeklyComparisonChart data={spendingTrends} />

      {/* Analytics Row 2 */}
      <div className="grid gap-6 lg:grid-cols-2">
        <PantryAnalytics />
        <RecipeAnalytics />
      </div>
    </div>
  );
}
