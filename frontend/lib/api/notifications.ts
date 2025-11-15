import { apiClient } from './client';
import { API_ROUTES } from '@/lib/constants/api-routes';
import type {
  Notification,
  NotificationsResponse,
  NotificationStats,
} from '@/types/notification.types';

/**
 * Notification API Service
 */
export const notificationApi = {
  /**
   * Get all notifications with filtering and pagination
   */
  getAll: async (params?: {
    isRead?: boolean;
    isDismissed?: boolean;
    notificationType?: string;
    priority?: string;
    page?: number;
    limit?: number;
  }): Promise<NotificationsResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.isRead !== undefined) queryParams.append('isRead', params.isRead.toString());
    if (params?.isDismissed !== undefined) queryParams.append('isDismissed', params.isDismissed.toString());
    if (params?.notificationType) queryParams.append('notificationType', params.notificationType);
    if (params?.priority) queryParams.append('priority', params.priority);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());

    const url = `${API_ROUTES.NOTIFICATIONS.BASE}${queryParams.toString() ? `?${queryParams}` : ''}`;
    return apiClient.get<NotificationsResponse>(url);
  },

  /**
   * Get a single notification by ID
   */
  getById: async (id: string): Promise<Notification> => {
    return apiClient.get<Notification>(API_ROUTES.NOTIFICATIONS.BY_ID(id));
  },

  /**
   * Mark notification as read
   */
  markAsRead: async (id: string): Promise<Notification> => {
    return apiClient.patch<Notification>(API_ROUTES.NOTIFICATIONS.MARK_READ(id), {});
  },

  /**
   * Mark all notifications as read
   */
  markAllAsRead: async (): Promise<{ count: number }> => {
    return apiClient.post<{ count: number }>(API_ROUTES.NOTIFICATIONS.READ_ALL, {});
  },

  /**
   * Dismiss a notification
   */
  dismiss: async (id: string): Promise<Notification> => {
    return apiClient.patch<Notification>(API_ROUTES.NOTIFICATIONS.DISMISS(id), {});
  },

  /**
   * Delete a notification
   */
  delete: async (id: string): Promise<void> => {
    return apiClient.delete<void>(API_ROUTES.NOTIFICATIONS.BY_ID(id));
  },

  /**
   * Get notification statistics
   */
  getStats: async (): Promise<NotificationStats> => {
    return apiClient.get<NotificationStats>(API_ROUTES.NOTIFICATIONS.STATS);
  },

  /**
   * Generate automatic notifications (expiring items, budget warnings)
   */
  generate: async (): Promise<{ message: string; generated: any; total: number }> => {
    return apiClient.post<{ message: string; generated: any; total: number }>(
      API_ROUTES.NOTIFICATIONS.GENERATE,
      {}
    );
  },
};
