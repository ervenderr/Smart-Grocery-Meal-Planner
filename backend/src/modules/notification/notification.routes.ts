/**
 * Notification Routes
 *
 * Endpoints for managing user notifications
 */

import { Router } from 'express';
import { NotificationController } from './notification.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../middleware/errorHandler';
import { validateCreateNotification } from './notification.validation';
import { validationResult } from 'express-validator';

// Validation middleware
const validate = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      statusCode: 400,
      message: 'Validation failed',
      errors: errors.array(),
    });
  }
  next();
};

const router = Router();
const notificationController = new NotificationController();

// All notification routes require authentication
router.use(authenticate);

/**
 * GET /api/v1/notifications/stats
 * Get notification statistics (unread count, by type, etc.)
 */
router.get('/stats', asyncHandler(notificationController.getStats.bind(notificationController)));

/**
 * POST /api/v1/notifications/read-all
 * Mark all notifications as read
 */
router.post('/read-all', asyncHandler(notificationController.markAllAsRead.bind(notificationController)));

/**
 * POST /api/v1/notifications/generate
 * Generate automatic notifications (expiring items, budget warnings)
 */
router.post('/generate', asyncHandler(notificationController.generateNotifications.bind(notificationController)));

/**
 * GET /api/v1/notifications
 * Get all notifications with filtering and pagination
 *
 * Query params:
 * - isRead: boolean (filter by read status)
 * - isDismissed: boolean (filter by dismissed status)
 * - notificationType: string (filter by type)
 * - priority: string (filter by priority)
 * - page: number (pagination)
 * - limit: number (pagination)
 */
router.get('/', asyncHandler(notificationController.getNotifications.bind(notificationController)));

/**
 * POST /api/v1/notifications
 * Create a new notification (typically system-generated)
 */
router.post(
  '/',
  validateCreateNotification,
  validate,
  asyncHandler(notificationController.createNotification.bind(notificationController))
);

/**
 * GET /api/v1/notifications/:id
 * Get a single notification by ID
 */
router.get('/:id', asyncHandler(notificationController.getNotificationById.bind(notificationController)));

/**
 * PATCH /api/v1/notifications/:id/read
 * Mark a notification as read
 */
router.patch('/:id/read', asyncHandler(notificationController.markAsRead.bind(notificationController)));

/**
 * PATCH /api/v1/notifications/:id/dismiss
 * Dismiss a notification
 */
router.patch('/:id/dismiss', asyncHandler(notificationController.dismissNotification.bind(notificationController)));

/**
 * DELETE /api/v1/notifications/:id
 * Delete a notification
 */
router.delete('/:id', asyncHandler(notificationController.deleteNotification.bind(notificationController)));

export default router;
