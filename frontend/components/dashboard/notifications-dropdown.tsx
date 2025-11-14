'use client';

import { useState, useEffect } from 'react';
import { Bell, AlertTriangle, Info, CheckCircle, X } from 'lucide-react';
import { analyticsApi } from '@/lib/api/analytics';
import { pantryApi } from '@/lib/api/pantry';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

type Notification = {
  id: string;
  type: 'budget' | 'expiry' | 'info';
  title: string;
  message: string;
  link?: string;
  timestamp: Date;
  read: boolean;
};

export function NotificationsDropdown() {
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (showNotifications) {
      fetchNotifications();
    }
  }, [showNotifications]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const [budgetStatus, expiringItems] = await Promise.all([
        analyticsApi.getBudgetStatus().catch(() => null),
        pantryApi.getExpiringSoon(3).catch(() => []),
      ]);

      const newNotifications: Notification[] = [];

      // Budget notifications
      if (budgetStatus) {
        if (budgetStatus.status === 'exceeded') {
          newNotifications.push({
            id: 'budget-exceeded',
            type: 'budget',
            title: 'Budget Exceeded',
            message: `You've exceeded your weekly budget by ${((budgetStatus.percentageUsed - 100).toFixed(0))}%`,
            link: '/budget',
            timestamp: new Date(),
            read: false,
          });
        } else if (budgetStatus.status === 'warning') {
          newNotifications.push({
            id: 'budget-warning',
            type: 'budget',
            title: 'Approaching Budget Limit',
            message: `You've used ${budgetStatus.percentageUsed.toFixed(0)}% of your weekly budget`,
            link: '/budget',
            timestamp: new Date(),
            read: false,
          });
        }
      }

      // Expiry notifications
      if (expiringItems.length > 0) {
        newNotifications.push({
          id: 'items-expiring',
          type: 'expiry',
          title: 'Items Expiring Soon',
          message: `${expiringItems.length} item${expiringItems.length > 1 ? 's' : ''} expiring in the next 3 days`,
          link: '/pantry',
          timestamp: new Date(),
          read: false,
        });
      }

      // Welcome notification for new users
      if (newNotifications.length === 0) {
        newNotifications.push({
          id: 'welcome',
          type: 'info',
          title: 'Welcome to Kitcha!',
          message: 'Start by adding items to your pantry and setting up your budget',
          link: '/settings?tab=preferences',
          timestamp: new Date(),
          read: false,
        });
      }

      setNotifications(newNotifications);
    } catch (error) {
      console.error('Fetch notifications error:', error);
    } finally {
      setLoading(false);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'budget':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'expiry':
        return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      case 'info':
        return <Info className="h-4 w-4 text-blue-600" />;
    }
  };

  const getNotificationStyle = (type: Notification['type']) => {
    switch (type) {
      case 'budget':
        return 'border-l-4 border-red-500 bg-red-50';
      case 'expiry':
        return 'border-l-4 border-orange-500 bg-orange-50';
      case 'info':
        return 'border-l-4 border-blue-500 bg-blue-50';
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowNotifications(!showNotifications)}
        className="relative rounded-lg p-2 text-gray-600 hover:bg-gray-100 transition-colors"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {showNotifications && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowNotifications(false)}
          ></div>

          {/* Dropdown */}
          <div className="absolute right-0 top-full z-20 mt-2 w-80 sm:w-96 rounded-lg border border-gray-200 bg-white shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
              <button
                onClick={() => setShowNotifications(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Notifications List */}
            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent"></div>
                </div>
              ) : notifications.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {notifications.map((notification) => (
                    <Link
                      key={notification.id}
                      href={notification.link || '#'}
                      onClick={() => setShowNotifications(false)}
                      className={`block p-4 hover:bg-gray-50 transition-colors ${getNotificationStyle(notification.type)}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="rounded-full bg-white p-2 flex-shrink-0">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">
                            {notification.title}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-400 mt-2">
                            {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 px-4">
                  <div className="rounded-full bg-gray-100 p-3 mb-3">
                    <CheckCircle className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="text-sm font-medium text-gray-900">All caught up!</p>
                  <p className="text-xs text-gray-500 mt-1">No new notifications</p>
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="border-t border-gray-200 p-3">
                <Link
                  href="/settings?tab=preferences"
                  onClick={() => setShowNotifications(false)}
                  className="block text-center text-xs font-medium text-primary-600 hover:text-primary-700"
                >
                  Manage notification preferences
                </Link>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
