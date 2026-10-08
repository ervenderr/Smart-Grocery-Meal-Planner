'use client';

import { useState } from 'react';
import { Bell } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  NOTIFICATION_STATS_KEY,
  useNotificationStats,
} from '@/lib/notifications/use-notification-stats';
import { NotificationPanel } from './notification-panel';

export function NotificationBell() {
  const { unread } = useNotificationStats();
  const queryClient = useQueryClient();
  const [showPanel, setShowPanel] = useState(false);

  const handleNotificationUpdate = () => {
    void queryClient.invalidateQueries({ queryKey: NOTIFICATION_STATS_KEY });
  };

  return (
    <>
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="relative flex min-h-11 min-w-11 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-0 top-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-sm font-semibold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {showPanel && (
        <NotificationPanel
          onClose={() => setShowPanel(false)}
          onUpdate={handleNotificationUpdate}
        />
      )}
    </>
  );
}
