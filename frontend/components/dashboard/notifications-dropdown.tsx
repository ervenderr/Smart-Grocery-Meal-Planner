'use client';

import { NotificationBell } from '@/components/notifications/notification-bell';

/** Thin wrapper: adds no width or padding so the bell keeps its 44px target. */
export function NotificationsDropdown() {
  return <NotificationBell />;
}
