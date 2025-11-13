'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth-store';
import { Card } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { ShoppingCart, Package, Calendar, TrendingUp, ChefHat, Plus, AlertCircle } from 'lucide-react';
import { analyticsApi } from '@/lib/api/analytics';
import { pantryApi } from '@/lib/api/pantry';
import { recipeApi } from '@/lib/api/recipes';
import { mealPlanApi } from '@/lib/api/mealplans';
import toast from 'react-hot-toast';
import type { AnalyticsDashboard } from '@/types/budget.types';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsDashboard | null>(null);
  const [pantryCount, setPantryCount] = useState(0);
  const [recipeCount, setRecipeCount] = useState(0);
  const [mealPlanCount, setMealPlanCount] = useState(0);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [analyticsData, pantryData, recipesData, mealPlansData] = await Promise.all([
        analyticsApi.getDashboard(30).catch(() => null),
        pantryApi.getAll({ limit: 1 }).catch(() => ({ pagination: { total: 0 } })),
        recipeApi.getAll({ limit: 1 }).catch(() => ({ pagination: { total: 0 } })),
        mealPlanApi.getAll({ limit: 1 }).catch(() => ({ pagination: { total: 0 } })),
      ]);

      setAnalytics(analyticsData);
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

  const formatCurrency = (cents: number) => {
    return `₱${(cents / 100).toFixed(2)}`;
  };

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
      value: analytics?.budgetStatus ? `${analytics.budgetStatus.percentageUsed.toFixed(0)}%` : 'N/A',
      icon: TrendingUp,
      change: analytics?.budgetStatus
        ? `${formatCurrency(analytics.budgetStatus.remainingCents)} remaining`
        : 'No budget data',
      changeType: analytics?.budgetStatus?.status === 'healthy' ? 'positive' :
                   analytics?.budgetStatus?.status === 'warning' ? 'warning' : 'negative',
      color: analytics?.budgetStatus ? getBudgetStatusColor(analytics.budgetStatus.status) : 'bg-gray-500',
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card
              key={stat.name}
              className="p-6 cursor-pointer hover:shadow-md transition-shadow"
              onClick={stat.onClick}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">{stat.value}</p>
                  <p className="mt-1 text-xs text-gray-500">{stat.change}</p>
                </div>
                <div className={`rounded-lg ${stat.color} p-3`}>
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
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <button
              onClick={() => router.push('/pantry')}
              className="flex w-full items-center gap-3 rounded-lg border border-gray-200 p-3 text-left transition-colors hover:bg-gray-50"
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
              className="flex w-full items-center gap-3 rounded-lg border border-gray-200 p-3 text-left transition-colors hover:bg-gray-50"
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
              className="flex w-full items-center gap-3 rounded-lg border border-gray-200 p-3 text-left transition-colors hover:bg-gray-50"
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
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Spending Overview</h2>
          {analytics?.categoryBreakdown && analytics.categoryBreakdown.length > 0 ? (
            <div className="space-y-3">
              {analytics.categoryBreakdown.slice(0, 3).map((cat, index) => (
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
              {analytics.totalSpentCents !== undefined && (
                <div className="pt-3 border-t border-gray-200">
                  <div className="flex justify-between">
                    <span className="text-sm font-semibold text-gray-900">Total Spent (30 days)</span>
                    <span className="text-sm font-bold text-primary-600">
                      {formatCurrency(analytics.totalSpentCents)}
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

      {/* Savings Insights */}
      {analytics?.savingsInsights && analytics.savingsInsights.length > 0 && (
        <Card className="p-6 bg-green-50 border-green-200">
          <h2 className="text-lg font-semibold text-green-900 mb-4">Savings Opportunities</h2>
          <div className="space-y-3">
            {analytics.savingsInsights.map((insight, index) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-white rounded-lg">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{insight.title}</p>
                  <p className="text-xs text-gray-600 mt-1">{insight.description}</p>
                </div>
                <div className="text-right">
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
