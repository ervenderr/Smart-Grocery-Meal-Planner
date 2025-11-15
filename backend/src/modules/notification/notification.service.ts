/**
 * Notification Service
 *
 * Handles creation, retrieval, and management of user notifications
 */

import { prisma } from '../../config/database.config';
import { logger } from '../../config/logger.config';
import { AppError } from '../../middleware/errorHandler';
import type {
  NotificationResponse,
  CreateNotificationRequest,
  GetNotificationsQuery,
  PaginatedNotificationsResponse,
  NotificationStats,
} from './notification.types';

export class NotificationService {
  /**
   * Create a new notification
   */
  async createNotification(
    userId: string,
    data: CreateNotificationRequest
  ): Promise<NotificationResponse> {
    const notification = await prisma.notification.create({
      data: {
        userId,
        notificationType: data.notificationType,
        title: data.title,
        message: data.message,
        priority: data.priority || 'normal',
        actionUrl: data.actionUrl,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
        scheduledFor: data.scheduledFor,
        sentAt: data.scheduledFor ? null : new Date(), // Send immediately if not scheduled
      },
    });

    logger.info('Notification created', {
      service: 'kitcha-api',
      userId,
      notificationId: notification.id,
      type: notification.notificationType,
    });

    return this.formatNotification(notification);
  }

  /**
   * Create multiple notifications at once (bulk create)
   */
  async createBulkNotifications(
    userId: string,
    notifications: CreateNotificationRequest[]
  ): Promise<void> {
    await prisma.notification.createMany({
      data: notifications.map((n) => ({
        userId,
        notificationType: n.notificationType,
        title: n.title,
        message: n.message,
        priority: n.priority || 'normal',
        actionUrl: n.actionUrl,
        metadata: n.metadata ? JSON.stringify(n.metadata) : null,
        scheduledFor: n.scheduledFor,
        sentAt: n.scheduledFor ? null : new Date(),
      })),
    });

    logger.info('Bulk notifications created', {
      service: 'kitcha-api',
      userId,
      count: notifications.length,
    });
  }

  /**
   * Get user notifications with filtering and pagination
   */
  async getNotifications(
    userId: string,
    query: GetNotificationsQuery = {}
  ): Promise<NotificationResponse[] | PaginatedNotificationsResponse> {
    const {
      isRead,
      isDismissed,
      notificationType,
      priority,
      page = 1,
      limit = 50,
    } = query;

    // Build where clause
    const where: any = {
      userId,
    };

    if (isRead !== undefined) {
      where.isRead = isRead;
    }

    if (isDismissed !== undefined) {
      where.isDismissed = isDismissed;
    }

    if (notificationType) {
      where.notificationType = notificationType;
    }

    if (priority) {
      where.priority = priority;
    }

    // Get total count
    const total = await prisma.notification.count({ where });

    // Get unread count
    const unreadCount = await prisma.notification.count({
      where: { userId, isRead: false, isDismissed: false },
    });

    // Calculate pagination
    const skip = (page - 1) * limit;
    const totalPages = Math.ceil(total / limit);

    // Get notifications sorted by priority and creation date
    const notifications = await prisma.notification.findMany({
      where,
      orderBy: [
        { priority: 'desc' }, // urgent -> high -> normal -> low
        { createdAt: 'desc' },
      ],
      skip,
      take: limit,
    });

    const formattedNotifications = notifications.map((n) =>
      this.formatNotification(n)
    );

    // Return paginated response if page/limit specified
    if (query.page || query.limit) {
      return {
        notifications: formattedNotifications,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          unreadCount,
        },
      };
    }

    // Otherwise return just the array
    return formattedNotifications;
  }

  /**
   * Get a single notification by ID
   */
  async getNotificationById(
    userId: string,
    notificationId: string
  ): Promise<NotificationResponse> {
    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId,
      },
    });

    if (!notification) {
      throw new AppError('Notification not found', 404);
    }

    return this.formatNotification(notification);
  }

  /**
   * Mark notification as read
   */
  async markAsRead(userId: string, notificationId: string): Promise<NotificationResponse> {
    const notification = await prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new AppError('Notification not found', 404);
    }

    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return this.formatNotification(updated);
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string): Promise<{ count: number }> {
    const result = await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    logger.info('All notifications marked as read', {
      service: 'kitcha-api',
      userId,
      count: result.count,
    });

    return { count: result.count };
  }

  /**
   * Dismiss a notification
   */
  async dismissNotification(
    userId: string,
    notificationId: string
  ): Promise<NotificationResponse> {
    const notification = await prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new AppError('Notification not found', 404);
    }

    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: {
        isDismissed: true,
        dismissedAt: new Date(),
        isRead: true, // Auto-mark as read when dismissed
        readAt: notification.readAt || new Date(),
      },
    });

    return this.formatNotification(updated);
  }

  /**
   * Delete a notification
   */
  async deleteNotification(userId: string, notificationId: string): Promise<void> {
    const notification = await prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new AppError('Notification not found', 404);
    }

    await prisma.notification.delete({
      where: { id: notificationId },
    });

    logger.info('Notification deleted', {
      service: 'kitcha-api',
      userId,
      notificationId,
    });
  }

  /**
   * Get notification statistics
   */
  async getStats(userId: string): Promise<NotificationStats> {
    const notifications = await prisma.notification.findMany({
      where: { userId },
      select: {
        notificationType: true,
        priority: true,
        isRead: true,
      },
    });

    const total = notifications.length;
    const unread = notifications.filter((n) => !n.isRead).length;

    const byType: Record<string, number> = {};
    const byPriority: Record<string, number> = {};

    notifications.forEach((n) => {
      byType[n.notificationType] = (byType[n.notificationType] || 0) + 1;
      byPriority[n.priority] = (byPriority[n.priority] || 0) + 1;
    });

    return {
      total,
      unread,
      byType,
      byPriority,
    };
  }

  /**
   * Helper: Format notification for response
   */
  private formatNotification(notification: any): NotificationResponse {
    return {
      id: notification.id,
      userId: notification.userId,
      notificationType: notification.notificationType,
      title: notification.title,
      message: notification.message,
      priority: notification.priority,
      actionUrl: notification.actionUrl,
      metadata: notification.metadata ? JSON.parse(notification.metadata) : undefined,
      scheduledFor: notification.scheduledFor?.toISOString(),
      sentAt: notification.sentAt?.toISOString(),
      isRead: notification.isRead,
      readAt: notification.readAt?.toISOString(),
      isDismissed: notification.isDismissed,
      dismissedAt: notification.dismissedAt?.toISOString(),
      createdAt: notification.createdAt.toISOString(),
      updatedAt: notification.updatedAt.toISOString(),
    };
  }
}
