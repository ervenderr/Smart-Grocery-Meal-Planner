'use client';

import { Calendar } from 'lucide-react';
import { Card } from '@/components/ui/card';

export default function MealPlansPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Meal Plans</h1>
          <p className="mt-1 text-sm text-gray-600">
            Plan your weekly meals and generate shopping lists
          </p>
        </div>
      </div>

      <Card className="flex flex-col items-center justify-center p-12 text-center">
        <div className="rounded-full bg-purple-100 p-4">
          <Calendar className="h-12 w-12 text-purple-600" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-gray-900">Meal Planning</h3>
        <p className="mt-2 text-sm text-gray-600 max-w-sm">
          This feature is coming soon. Create weekly meal plans and auto-generate shopping lists.
        </p>
      </Card>
    </div>
  );
}
