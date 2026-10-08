'use client';

import { useQuery } from '@tanstack/react-query';
import { notificationApi } from '@/lib/api/notifications';
import { useAuthStore } from '@/lib/stores/auth-store';

export const NOTIFICATION_STATS_KEY = ['notification-stats'] as const;

/** Single shared unread-count poll (bell and More tab). */
export function useNotificationStats(): { unread: number } {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const { data } = useQuery({
    queryKey: NOTIFICATION_STATS_KEY,
    queryFn: notificationApi.getStats,
    refetchInterval: 30000,
    enabled: isAuthenticated,
  });

  return { unread: data?.unread ?? 0 };
}

