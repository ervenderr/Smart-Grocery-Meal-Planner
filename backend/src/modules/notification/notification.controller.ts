/**
 * Notification Controller
 *
 * HTTP request handlers for notification endpoints
 */

import { Request, Response } from 'express';
import { NotificationService } from './notification.service';
import { NotificationGenerator } from './notification.generator';
import { asyncHandler } from '../../middleware/errorHandler';
import type { CreateNotificationRequest, GetNotificationsQuery } from './notification.types';

export class NotificationController {
  private notificationService: NotificationService;
  private notificationGenerator: NotificationGenerator;

  constructor() {
    this.notificationService = new NotificationService();
    this.notificationGenerator = new NotificationGenerator();
  }

  /**
   * Get all notifications for the authenticated user
   * GET /api/v1/notifications
   */
  getNotifications = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const query: GetNotificationsQuery = {
      isRead: req.query.isRead === 'true' ? true : req.query.isRead === 'false' ? false : undefined,
      isDismissed: req.query.isDismissed === 'true' ? true : req.query.isDismissed === 'false' ? false : undefined,
      notificationType: req.query.notificationType as any,
      priority: req.query.priority as any,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    };

    const result = await this.notificationService.getNotifications(userId, query);

    res.status(200).json(result);
  });

  /**
   * Get a single notification by ID
   * GET /api/v1/notifications/:id
   */
  getNotificationById = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const notificationId = req.params.id;

    const notification = await this.notificationService.getNotificationById(userId, notificationId);

    res.status(200).json(notification);
  });

  /**
   * Create a new notification (typically called by system, not users)
   * POST /api/v1/notifications
   */
  createNotification = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const data: CreateNotificationRequest = req.body;

    const notification = await this.notificationService.createNotification(userId, data);

    res.status(201).json(notification);
  });

  /**
   * Mark notification as read
   * PATCH /api/v1/notifications/:id/read
   */
  markAsRead = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const notificationId = req.params.id;

    const notification = await this.notificationService.markAsRead(userId, notificationId);

    res.status(200).json(notification);
  });

  /**
   * Mark all notifications as read
   * POST /api/v1/notifications/read-all
   */
  markAllAsRead = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;

    const result = await this.notificationService.markAllAsRead(userId);

    res.status(200).json(result);
  });

  /**
   * Dismiss a notification
   * PATCH /api/v1/notifications/:id/dismiss
   */
  dismissNotification = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const notificationId = req.params.id;

    const notification = await this.notificationService.dismissNotification(userId, notificationId);

    res.status(200).json(notification);
  });

  /**
   * Delete a notification
   * DELETE /api/v1/notifications/:id
   */
  deleteNotification = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const notificationId = req.params.id;

    await this.notificationService.deleteNotification(userId, notificationId);

    res.status(200).json({ message: 'Notification deleted successfully' });
  });

  /**
   * Get notification statistics
   * GET /api/v1/notifications/stats
   */
  getStats = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;

    const stats = await this.notificationService.getStats(userId);

    res.status(200).json(stats);
  });

  /**
   * Generate automatic notifications (expiring items, budget warnings)
   * POST /api/v1/notifications/generate
   */
  generateNotifications = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;

    const result = await this.notificationGenerator.generateAllNotifications(userId);

    res.status(200).json({
      message: 'Notifications generated successfully',
      generated: result,
      total: result.expiring + result.expired + result.budget,
    });
  });
}
