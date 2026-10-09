'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth-store';
import { Card } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { ShoppingCart, Package, Calendar, TrendingUp, ChefHat, Plus, AlertCircle, CheckCircle } from 'lucide-react';
import { analyticsApi } from '@/lib/api/analytics';
import { pantryApi } from '@/lib/api/pantry';
import { recipeApi } from '@/lib/api/recipes';
import { mealPlanApi } from '@/lib/api/mealplans';
import { EmptyState } from '@/components/common/empty-state';
import { useCurrency } from '@/lib/currency/currency-provider';
import type { ExpiringItem } from '@/types/pantry.types';
import type { AnalyticsDashboard } from '@/types/budget.types';
import { formatExpiryLabel, toExpiringItems } from '@/lib/pantry/expiry';
import { budgetFromComparison, formatPercent } from '@/lib/analytics/budget';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const { format: formatCurrency } = useCurrency();
  const [expiring, setExpiring] = useState<ExpiringItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsDashboard | null>(null);
  const [pantryCount, setPantryCount] = useState(0);
  const [recipeCount, setRecipeCount] = useState(0);
  const [mealPlanCount, setMealPlanCount] = useState(0);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [analyticsData, pantryData, recipesData, mealPlansData, expiringData] = await Promise.all([
        analyticsApi.getDashboard(30).catch(() => null),
        pantryApi.getAll({ limit: 1 }).catch(() => ({ items: [], pagination: { total: 0, page: 1, limit: 1, totalPages: 1 } })),
        recipeApi.getAll({ limit: 1 }).catch(() => ({ items: [], pagination: { total: 0, page: 1, limit: 1, totalPages: 1 } })),
        mealPlanApi.getAll({ limit: 1 }).catch(() => ({ items: [], pagination: { total: 0, page: 1, limit: 1, totalPages: 1 } })),
        pantryApi.getExpiringSoon(7).catch(() => []),
      ]);

      setAnalytics(analyticsData);
      setExpiring(toExpiringItems(expiringData));
      setPantryCount(pantryData.pagination?.total || 0);
      setRecipeCount(recipesData.pagination?.total || 0);
      setMealPlanCount(mealPlansData.pagination?.total || 0);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const getBudgetStatusColor = (status?: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-500';
      case 'warning':
        return 'bg-yellow-500';
      case 'exceeded':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const budget = budgetFromComparison(analytics?.budgetStatus);

  const stats = [
    {
      name: 'Pantry Items',
      value: pantryCount.toString(),
      icon: Package,
      change: 'Total items tracked',
      changeType: 'neutral',
      color: 'bg-blue-500',
      onClick: () => router.push('/pantry'),
    },
    {
      name: 'Recipes',
      value: recipeCount.toString(),
      icon: ChefHat,
      change: 'Saved recipes',
      changeType: 'neutral',
      color: 'bg-green-500',
      onClick: () => router.push('/recipes'),
    },
    {
      name: 'Meal Plans',
      value: mealPlanCount.toString(),
      icon: Calendar,
      change: 'Total meal plans',
      changeType: 'neutral',
      color: 'bg-purple-500',
      onClick: () => router.push('/mealplans'),
    },
    {
      name: 'Budget Status',
      value: budget ? formatPercent(budget.percentageUsed) : 'N/A',
      icon: TrendingUp,
      change: budget
        ? budget.remainingCents < 0
          ? `${formatCurrency(Math.abs(budget.remainingCents))} over budget`
          : `${formatCurrency(budget.remainingCents)} remaining`
        : 'No budget data',
      changeType: budget?.status === 'healthy' ? 'positive' :
                   budget?.status === 'warning' ? 'warning' : 'negative',
      color: getBudgetStatusColor(budget?.status),
      onClick: () => router.push('/budget'),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
          Welcome back, {user?.firstName || 'User'}!
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Here's an overview of your grocery and meal planning activity.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card
              key={stat.name}
              className="min-w-0 cursor-pointer p-4 transition-shadow hover:shadow-md sm:p-6"
              onClick={stat.onClick}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                  <p className="mt-2 text-2xl font-bold sm:text-3xl text-gray-900">{stat.value}</p>
                  <p className="mt-1 break-words text-xs text-gray-500">{stat.change}</p>
                </div>
                <div className={`hidden shrink-0 rounded-lg ${stat.color} p-3 sm:block`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Quick Actions & Insights Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quick Actions */}
        <Card className="min-w-0 p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <button
              onClick={() => router.push('/pantry')}
              className="flex min-h-11 w-full items-center gap-3 rounded-lg border border-gray-200 p-3 text-left transition-colors hover:bg-gray-50"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Manage Pantry</p>
                <p className="text-xs text-gray-500">Track ingredients at home</p>
              </div>
              <Plus className="h-5 w-5 text-gray-400 ml-auto" />
            </button>
            <button
              onClick={() => router.push('/recipes')}
              className="flex min-h-11 w-full items-center gap-3 rounded-lg border border-gray-200 p-3 text-left transition-colors hover:bg-gray-50"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                <ChefHat className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Add Recipe</p>
                <p className="text-xs text-gray-500">Save your favorite recipes</p>
              </div>
              <Plus className="h-5 w-5 text-gray-400 ml-auto" />
            </button>
            <button
              onClick={() => router.push('/mealplans')}
              className="flex min-h-11 w-full items-center gap-3 rounded-lg border border-gray-200 p-3 text-left transition-colors hover:bg-gray-50"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                <Calendar className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Create Meal Plan</p>
                <p className="text-xs text-gray-500">Plan your weekly meals</p>
              </div>
              <Plus className="h-5 w-5 text-gray-400 ml-auto" />
            </button>
          </div>
        </Card>

        {/* Spending Insights */}
        <Card className="min-w-0 p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Spending Overview</h2>
          {analytics && analytics.topCategories.length > 0 ? (
            <div className="space-y-3">
              {analytics.topCategories.slice(0, 3).map((cat, index) => (
                <div key={index}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium capitalize">{cat.category}</span>
                    <span className="text-gray-600">{formatCurrency(cat.totalSpentCents)}</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-500 transition-all"
                      style={{ width: `${cat.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
              {analytics.summary && (
                <div className="pt-3 border-t border-gray-200">
                  <div className="flex justify-between">
                    <span className="text-sm font-semibold text-gray-900">Total Spent (30 days)</span>
                    <span className="text-sm font-bold text-primary-600">
                      {formatCurrency(analytics.summary.totalSpentCents)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertCircle className="h-12 w-12 text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">No spending data yet</p>
              <p className="text-xs text-gray-400 mt-1">Start tracking by creating meal plans</p>
            </div>
          )}
        </Card>
      </div>

      {/* Expiring Soon */}
      <Card className="min-w-0 p-4 sm:p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Expiring Soon</h2>
        {expiring.length > 0 ? (
          <ul className="space-y-2">
            {expiring.slice(0, 5).map((entry) => (
              <li key={entry.item.id} className="flex min-h-11 items-center justify-between gap-2 rounded-lg bg-gray-50 p-2 text-sm">
                <span className="min-w-0 truncate font-medium capitalize text-gray-900">{entry.item.ingredientName}</span>
                <span className="shrink-0 text-gray-600">
                  {formatExpiryLabel(entry.daysUntilExpiry)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={CheckCircle}
            title="Nothing expiring soon"
            description="Your pantry looks good."
            headingLevel="h3"
          />
        )}
      </Card>

      {/* Savings Insights */}
      {analytics && analytics.savingsInsights.length > 0 && (
        <Card className="min-w-0 border-green-200 bg-green-50 p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-green-900 mb-4">Savings Opportunities</h2>
          <div className="space-y-3">
            {analytics.savingsInsights.map((insight, index) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-white rounded-lg">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">{insight.title}</p>
                  <p className="text-xs text-gray-600 mt-1">{insight.description}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-green-600">
                    {formatCurrency(insight.amountSavedCents)}
                  </p>
                  <p className="text-xs text-gray-500">saved</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
