'use client';

import { BarChart3 } from 'lucide-react';
import { Card } from '@/components/ui/card';

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Analytics</h1>
          <p className="mt-1 text-sm text-gray-600">
            View spending trends and insights
          </p>
        </div>
      </div>

      <Card className="flex flex-col items-center justify-center p-12 text-center">
        <div className="rounded-full bg-indigo-100 p-4">
          <BarChart3 className="h-12 w-12 text-indigo-600" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-gray-900">Analytics & Insights</h3>
        <p className="mt-2 text-sm text-gray-600 max-w-sm">
          This feature is coming soon. View charts, trends, and spending insights.
        </p>
      </Card>
    </div>
  );
}
