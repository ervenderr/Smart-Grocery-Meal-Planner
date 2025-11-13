/**
 * Alert Types
 *
 * Type definitions for budget alerts and notifications.
 */

/**
 * Alert type enum
 */
export enum AlertType {
  BUDGET_EXCEEDED = 'budget_exceeded',
  ITEM_EXPIRING = 'item_expiring',
  PRICE_SPIKE = 'price_spike',
  TREND_ALERT = 'trend_alert',
}

/**
 * Create alert request
 */
export interface CreateAlertRequest {
  alertType: string;
  title: string;
  message: string;
  threshold?: number;
  actualValue?: number;
}

/**
 * Alert response
 */
export interface AlertResponse {
  id: string;
  userId: string;
  alertType: string;
  title: string;
  message: string;
  threshold?: number;
  actualValue?: number;
  isRead: boolean;
  readAt?: string;
  dismissedAt?: string;
  createdAt: string;
}

/**
 * Query parameters for getting alerts
 */
export interface GetAlertsQuery {
  alertType?: string;
  isRead?: boolean;
  dismissed?: boolean;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'alertType';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated alert response
 */
export interface PaginatedAlertResponse {
  items: AlertResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Mark alert as read request
 */
export interface MarkAlertReadRequest {
  isRead: boolean;
}

/**
 * Budget status response
 */
export interface BudgetStatusResponse {
  weeklyBudgetCents: number;
  spentThisWeekCents: number;
  remainingCents: number;
  percentageUsed: number;
  status: 'healthy' | 'warning' | 'exceeded';
  weekStart: string;
  weekEnd: string;
}

/**
 * Alert statistics
 */
export interface AlertStatsResponse {
  totalAlerts: number;
  unreadCount: number;
  byType: Record<string, number>;
  recentAlerts: AlertResponse[];
}
