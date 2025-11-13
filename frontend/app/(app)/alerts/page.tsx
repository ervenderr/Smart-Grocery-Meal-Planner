'use client';

import { Bell } from 'lucide-react';
import { Card } from '@/components/ui/card';

export default function AlertsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Alerts</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage your budget and expiration alerts
          </p>
        </div>
      </div>

      <Card className="flex flex-col items-center justify-center p-12 text-center">
        <div className="rounded-full bg-red-100 p-4">
          <Bell className="h-12 w-12 text-red-600" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-gray-900">Alerts & Notifications</h3>
        <p className="mt-2 text-sm text-gray-600 max-w-sm">
          This feature is coming soon. Get alerts for budget limits and expiring items.
        </p>
      </Card>
    </div>
  );
}
