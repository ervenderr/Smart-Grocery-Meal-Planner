'use client';

import { ShoppingBasket } from 'lucide-react';
import { Card } from '@/components/ui/card';

export default function ShoppingPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Shopping Lists</h1>
          <p className="mt-1 text-sm text-gray-600">
            Create and manage your grocery shopping lists
          </p>
        </div>
      </div>

      <Card className="flex flex-col items-center justify-center p-12 text-center">
        <div className="rounded-full bg-blue-100 p-4">
          <ShoppingBasket className="h-12 w-12 text-blue-600" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-gray-900">Shopping Lists</h3>
        <p className="mt-2 text-sm text-gray-600 max-w-sm">
          This feature is coming soon. Create smart shopping lists and check off items as you shop.
        </p>
      </Card>
    </div>
  );
}
