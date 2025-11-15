/**
 * Notification Generator Service
 *
 * Automatically generates notifications for various system events
 */

import { prisma } from '../../config/database.config';
import { logger } from '../../config/logger.config';
import { NotificationService } from './notification.service';
import type { CreateNotificationRequest } from './notification.types';

export class NotificationGenerator {
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

  /**
   * Check for expiring pantry items and create notifications
   */
  async generateExpiringItemNotifications(userId: string): Promise<number> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Check for items expiring in the next 3 days
    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setUTCDate(threeDaysFromNow.getUTCDate() + 3);

    // Check for items expiring in the next 7 days
    const sevenDaysFromNow = new Date(today);
    sevenDaysFromNow.setUTCDate(sevenDaysFromNow.getUTCDate() + 7);

    // Get expiring items
    const expiringItems = await prisma.pantryItem.findMany({
      where: {
        userId,
        deletedAt: null,
        expiryDate: {
          gte: today,
          lte: sevenDaysFromNow,
        },
      },
      orderBy: {
        expiryDate: 'asc',
      },
    });

    // Check if we already sent notifications for these items today
    const existingNotifications = await prisma.notification.findMany({
      where: {
        userId,
        notificationType: {
          in: ['ingredient_expiring', 'ingredient_expired'],
        },
        createdAt: {
          gte: today,
        },
      },
      select: {
        metadata: true,
      },
    });

    const notifiedItemIds = new Set(
      existingNotifications
        .map((n) => {
          try {
            const metadata = JSON.parse(n.metadata || '{}');
            return metadata.itemId;
          } catch {
            return null;
          }
        })
        .filter(Boolean)
    );

    const notifications: CreateNotificationRequest[] = [];

    for (const item of expiringItems) {
      // Skip if already notified today
      if (notifiedItemIds.has(item.id)) {
        continue;
      }

      const daysUntilExpiry = Math.ceil(
        (new Date(item.expiryDate!).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      let priority: 'high' | 'urgent' = 'high';
      let title = '';
      let message = '';

      if (daysUntilExpiry <= 1) {
        priority = 'urgent';
        title = `${item.ingredientName} expires ${daysUntilExpiry === 0 ? 'today' : 'tomorrow'}!`;
        message = `Use ${item.quantity} ${item.unit} of ${item.ingredientName} soon to avoid waste.`;
      } else if (daysUntilExpiry <= 3) {
        priority = 'urgent';
        title = `${item.ingredientName} expires in ${daysUntilExpiry} days`;
        message = `You have ${item.quantity} ${item.unit} of ${item.ingredientName} expiring soon.`;
      } else {
        priority = 'high';
        title = `${item.ingredientName} expires in ${daysUntilExpiry} days`;
        message = `Plan to use ${item.quantity} ${item.unit} of ${item.ingredientName} this week.`;
      }

      notifications.push({
        notificationType: 'ingredient_expiring',
        title,
        message,
        priority,
        actionUrl: '/pantry',
        metadata: {
          itemId: item.id,
          itemName: item.ingredientName,
          daysUntilExpiry,
        },
      });
    }

    // Create all notifications
    if (notifications.length > 0) {
      await this.notificationService.createBulkNotifications(userId, notifications);

      logger.info('Expiring item notifications generated', {
        service: 'kitcha-api',
        userId,
        count: notifications.length,
      });
    }

    return notifications.length;
  }

  /**
   * Check for expired pantry items and create notifications
   */
  async generateExpiredItemNotifications(userId: string): Promise<number> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Get expired items
    const expiredItems = await prisma.pantryItem.findMany({
      where: {
        userId,
        deletedAt: null,
        expiryDate: {
          lt: today,
        },
      },
    });

    // Check if we already sent notifications for these items
    const existingNotifications = await prisma.notification.findMany({
      where: {
        userId,
        notificationType: 'ingredient_expired',
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      },
      select: {
        metadata: true,
      },
    });

    const notifiedItemIds = new Set(
      existingNotifications
        .map((n) => {
          try {
            const metadata = JSON.parse(n.metadata || '{}');
            return metadata.itemId;
          } catch {
            return null;
          }
        })
        .filter(Boolean)
    );

    const notifications: CreateNotificationRequest[] = [];

    for (const item of expiredItems) {
      // Skip if already notified
      if (notifiedItemIds.has(item.id)) {
        continue;
      }

      notifications.push({
        notificationType: 'ingredient_expired',
        title: `${item.ingredientName} has expired`,
        message: `Remove expired ${item.ingredientName} from your pantry.`,
        priority: 'normal',
        actionUrl: '/pantry',
        metadata: {
          itemId: item.id,
          itemName: item.ingredientName,
        },
      });
    }

    // Create all notifications
    if (notifications.length > 0) {
      await this.notificationService.createBulkNotifications(userId, notifications);

      logger.info('Expired item notifications generated', {
        service: 'kitcha-api',
        userId,
        count: notifications.length,
      });
    }

    return notifications.length;
  }

  /**
   * Check budget usage and create warning notifications
   */
  async generateBudgetNotifications(userId: string): Promise<number> {
    // Get user preferences for budget
    const preferences = await prisma.userPreference.findUnique({
      where: { userId },
    });

    if (!preferences || !preferences.budgetPerWeekCents) {
      return 0; // No budget set
    }

    // Get current week's spending (Monday to Sunday)
    const today = new Date();
    const dayOfWeek = today.getDay();
    const startOfWeek = new Date(today);
    startOfWeek.setUTCDate(today.getUTCDate() - ((dayOfWeek + 6) % 7)); // Monday
    startOfWeek.setUTCHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setUTCDate(startOfWeek.getUTCDate() + 7);

    const spending = await prisma.shoppingHistory.aggregate({
      where: {
        userId,
        receiptDate: {
          gte: startOfWeek,
          lt: endOfWeek,
        },
      },
      _sum: {
        totalPhpCents: true,
      },
    });

    const totalSpent = spending._sum.totalPhpCents || 0;
    const budgetCents = preferences.budgetPerWeekCents;
    const percentageUsed = (totalSpent / budgetCents) * 100;

    // Check if we already sent a budget notification today
    const notificationCheckDate = new Date();
    notificationCheckDate.setUTCHours(0, 0, 0, 0);

    const existingNotification = await prisma.notification.findFirst({
      where: {
        userId,
        notificationType: {
          in: ['budget_warning', 'budget_exceeded'],
        },
        createdAt: {
          gte: notificationCheckDate,
        },
      },
    });

    if (existingNotification) {
      return 0; // Already notified today
    }

    const notifications: CreateNotificationRequest[] = [];

    // Budget exceeded (100%+)
    if (percentageUsed >= 100) {
      notifications.push({
        notificationType: 'budget_exceeded',
        title: 'Budget exceeded!',
        message: `You've spent ₱${(totalSpent / 100).toFixed(2)} of your ₱${(budgetCents / 100).toFixed(2)} weekly budget (${percentageUsed.toFixed(0)}%).`,
        priority: 'urgent',
        actionUrl: '/budget',
        metadata: {
          budgetAmount: budgetCents,
          spentAmount: totalSpent,
          percentageUsed: Math.round(percentageUsed),
        },
      });
    }
    // Budget warning (80%+)
    else if (percentageUsed >= 80) {
      notifications.push({
        notificationType: 'budget_warning',
        title: 'Budget warning',
        message: `You've used ${percentageUsed.toFixed(0)}% of your weekly budget. ₱${((budgetCents - totalSpent) / 100).toFixed(2)} remaining.`,
        priority: 'high',
        actionUrl: '/budget',
        metadata: {
          budgetAmount: budgetCents,
          spentAmount: totalSpent,
          percentageUsed: Math.round(percentageUsed),
        },
      });
    }

    // Create notifications
    if (notifications.length > 0) {
      await this.notificationService.createBulkNotifications(userId, notifications);

      logger.info('Budget notifications generated', {
        service: 'kitcha-api',
        userId,
        count: notifications.length,
      });
    }

    return notifications.length;
  }

  /**
   * Generate all automatic notifications for a user
   */
  async generateAllNotifications(userId: string): Promise<{
    expiring: number;
    expired: number;
    budget: number;
  }> {
    const [expiring, expired, budget] = await Promise.all([
      this.generateExpiringItemNotifications(userId),
      this.generateExpiredItemNotifications(userId),
      this.generateBudgetNotifications(userId),
    ]);

    return { expiring, expired, budget };
  }
}
