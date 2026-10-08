'use client';

import { Bell } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';

export default function AlertsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Alerts</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage your budget and expiration alerts
          </p>
        </div>
      </div>

      <EmptyState
        icon={Bell}
        title="You're all caught up"
        description="Budget and expiry alerts will show up here."
      />
    </div>
  );
}
