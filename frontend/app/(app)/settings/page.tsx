'use client';

import { Settings } from 'lucide-react';
import { Card } from '@/components/ui/card';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Settings</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage your preferences and account settings
          </p>
        </div>
      </div>

      <Card className="flex flex-col items-center justify-center p-12 text-center">
        <div className="rounded-full bg-gray-100 p-4">
          <Settings className="h-12 w-12 text-gray-600" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-gray-900">Settings Panel</h3>
        <p className="mt-2 text-sm text-gray-600 max-w-sm">
          This feature is coming soon. Configure your preferences, notifications, and account
          settings.
        </p>
      </Card>
    </div>
  );
}
