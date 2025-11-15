/**
 * Notification Types
 */

export type NotificationType =
  | 'ingredient_expiring'
  | 'ingredient_expired'
  | 'budget_warning'
  | 'budget_exceeded'
  | 'meal_prep_reminder'
  | 'shopping_day_reminder'
  | 'low_stock'
  | 'price_drop'
  | 'meal_plan_due';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface NotificationMetadata {
  [key: string]: any;
  itemId?: string;
  itemName?: string;
  daysUntilExpiry?: number;
  budgetAmount?: number;
  spentAmount?: number;
  percentageUsed?: number;
}

export interface Notification {
  id: string;
  userId: string;
  notificationType: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  actionUrl?: string;
  metadata?: NotificationMetadata;
  scheduledFor?: string;
  sentAt?: string;
  isRead: boolean;
  readAt?: string;
  isDismissed: boolean;
  dismissedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationsResponse {
  notifications: Notification[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    unreadCount: number;
  };
}

export interface NotificationStats {
  total: number;
  unread: number;
  byType: Record<string, number>;
  byPriority: Record<string, number>;
}
