'use client';

import { TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';

export default function BudgetPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Budget Tracking</h1>
          <p className="mt-1 text-sm text-gray-600">
            Monitor your grocery spending and stay within budget
          </p>
        </div>
      </div>

      <Card className="flex flex-col items-center justify-center p-12 text-center">
        <div className="rounded-full bg-amber-100 p-4">
          <TrendingUp className="h-12 w-12 text-amber-600" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-gray-900">Budget Management</h3>
        <p className="mt-2 text-sm text-gray-600 max-w-sm">
          This feature is coming soon. Set budgets, track spending, and get insights.
        </p>
      </Card>
    </div>
  );
}
