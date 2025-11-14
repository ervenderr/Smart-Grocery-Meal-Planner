'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, Banknote, AlertCircle, TrendingDown, PiggyBank } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/common/loading-spinner';
import { analyticsApi } from '@/lib/api/analytics';
import toast from 'react-hot-toast';
import type { BudgetStatus, CategorySpending } from '@/types/budget.types';

export default function BudgetPage() {
  const [budgetStatus, setBudgetStatus] = useState<BudgetStatus | null>(null);
  const [categories, setCategories] = useState<CategorySpending[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBudgetData = async () => {
    setLoading(true);
    try {
      const [status, categoryData] = await Promise.all([
        analyticsApi.getBudgetStatus(),
        analyticsApi.getCategoryBreakdown(),
      ]);
      setBudgetStatus(status);
      setCategories(categoryData || []);
    } catch (error: any) {
      console.error('Fetch budget error:', error);
      toast.error('Failed to load budget data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBudgetData();
  }, []);

  const formatCurrency = (cents: number) => {
    return `₱${(cents / 100).toFixed(2)}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'exceeded':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <PiggyBank className="h-8 w-8 text-green-600" />;
      case 'warning':
        return <AlertCircle className="h-8 w-8 text-yellow-600" />;
      case 'exceeded':
        return <TrendingUp className="h-8 w-8 text-red-600" />;
      default:
        return <Banknote className="h-8 w-8 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Budget Tracking</h1>
        <p className="mt-1 text-sm text-gray-600">
          Monitor your grocery spending and stay within budget
        </p>
      </div>

      {/* Budget Status Card */}
      {budgetStatus && (
        <Card className={`p-6 border-2 ${getStatusColor(budgetStatus.status)}`}>
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-white p-3">
              {getStatusIcon(budgetStatus.status)}
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-1 capitalize">
                {budgetStatus.status === 'healthy' ? 'On Track' : budgetStatus.status === 'warning' ? 'Approaching Limit' : 'Budget Exceeded'}
              </h3>
              <p className="text-sm mb-4">
                Week of {new Date(budgetStatus.weekStart).toLocaleDateString()} - {new Date(budgetStatus.weekEnd).toLocaleDateString()}
              </p>

              {/* Progress Bar */}
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium">Budget Usage</span>
                  <span className="font-semibold">{budgetStatus.percentageUsed.toFixed(0)}%</span>
                </div>
                <div className="h-3 bg-white rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      budgetStatus.status === 'healthy' ? 'bg-green-500' :
                      budgetStatus.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(budgetStatus.percentageUsed, 100)}%` }}
                  />
                </div>
              </div>

              {/* Budget Details */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs opacity-75">Weekly Budget</p>
                  <p className="text-lg font-bold">{formatCurrency(budgetStatus.weeklyBudgetCents)}</p>
                </div>
                <div>
                  <p className="text-xs opacity-75">Spent</p>
                  <p className="text-lg font-bold">{formatCurrency(budgetStatus.spentThisWeekCents)}</p>
                </div>
                <div>
                  <p className="text-xs opacity-75">Remaining</p>
                  <p className="text-lg font-bold">{formatCurrency(budgetStatus.remainingCents)}</p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Category Breakdown */}
      {categories.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Spending by Category</h3>
          <div className="space-y-3">
            {categories.slice(0, 5).map((cat, index) => (
              <div key={index}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium capitalize">{cat.category}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500">{cat.itemCount} items</span>
                    <span className="font-semibold">{formatCurrency(cat.totalSpentCents)}</span>
                  </div>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary-500 transition-all"
                    style={{ width: `${cat.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Empty State */}
      {!budgetStatus && !loading && (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <div className="rounded-full bg-gray-100 p-4">
            <TrendingDown className="h-12 w-12 text-gray-400" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-gray-900">No Budget Data</h3>
          <p className="mt-2 text-sm text-gray-600 max-w-sm">
            Start tracking your spending by creating shopping lists and recording purchases
          </p>
        </Card>
      )}
    </div>
  );
}
