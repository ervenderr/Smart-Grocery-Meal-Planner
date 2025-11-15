'use client';

import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { notificationApi } from '@/lib/api/notifications';
import { NotificationPanel } from './notification-panel';

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [showPanel, setShowPanel] = useState(false);

  const fetchUnreadCount = async () => {
    try {
      const stats = await notificationApi.getStats();
      setUnreadCount(stats.unread);
    } catch (error) {
      console.error('Failed to fetch notification stats:', error);
    }
  };

  useEffect(() => {
    fetchUnreadCount();

    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleNotificationUpdate = () => {
    fetchUnreadCount();
  };

  return (
    <>
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="relative rounded-lg p-2 text-gray-600 hover:bg-gray-100 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
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
