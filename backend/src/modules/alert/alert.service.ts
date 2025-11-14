/**
 * Alert Service
 *
 * Business logic for budget alerts and notifications.
 */

import { prisma } from '../../config/database.config';
import { logger } from '../../config/logger.config';
import { AppError } from '../../middleware/errorHandler';
import {
  CreateAlertRequest,
  AlertResponse,
  GetAlertsQuery,
  PaginatedAlertResponse,
  BudgetStatusResponse,
  AlertStatsResponse,
} from '../../types/alert.types';

export class AlertService {
  /**
   * Create a new alert
   */
  async createAlert(
    userId: string,
    data: CreateAlertRequest
  ): Promise<AlertResponse> {
    const { alertType, title, message, threshold, actualValue } = data;

    const alert = await prisma.alert.create({
      data: {
        userId,
        alertType,
        title: title.trim(),
        message: message.trim(),
        threshold,
        actualValue,
      },
    });

    logger.info('Alert created', {
      service: 'kitcha-api',
      userId,
      alertId: alert.id,
      alertType: alert.alertType,
    });

    return this.formatAlert(alert);
  }

  /**
   * Get all alerts for a user with filtering and pagination
   */
  async getAlerts(
    userId: string,
    query: GetAlertsQuery
  ): Promise<PaginatedAlertResponse> {
    const {
      alertType,
      isRead,
      dismissed,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 50,
    } = query;

    // Build where clause
    const where: any = { userId };

    if (alertType) {
      where.alertType = alertType;
    }

    if (isRead !== undefined) {
      where.isRead = isRead;
    }

    if (dismissed !== undefined) {
      if (dismissed) {
        where.dismissedAt = { not: null };
      } else {
        where.dismissedAt = null;
      }
    }

    // Get total count
    const total = await prisma.alert.count({ where });

    // Calculate pagination
    const skip = (page - 1) * limit;
    const totalPages = Math.ceil(total / limit);

    // Build orderBy clause
    const orderBy: any = {};
    if (sortBy === 'alertType') {
      orderBy.alertType = sortOrder;
    } else {
      orderBy.createdAt = sortOrder;
    }

    // Get alerts
    const alerts = await prisma.alert.findMany({
      where,
      orderBy,
      skip,
      take: limit,
    });

    return {
      items: alerts.map((alert) => this.formatAlert(alert)),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Get a single alert by ID
   */
  async getAlertById(userId: string, alertId: string): Promise<AlertResponse> {
    const alert = await prisma.alert.findFirst({
      where: {
        id: alertId,
        userId,
      },
    });

    if (!alert) {
      throw new AppError('Alert not found', 404);
    }

    return this.formatAlert(alert);
  }

  /**
   * Mark alert as read
   */
  async markAsRead(userId: string, alertId: string): Promise<AlertResponse> {
    const existingAlert = await prisma.alert.findFirst({
      where: {
        id: alertId,
        userId,
      },
    });

    if (!existingAlert) {
      throw new AppError('Alert not found', 404);
    }

    const alert = await prisma.alert.update({
      where: { id: alertId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return this.formatAlert(alert);
  }

  /**
   * Dismiss alert
   */
  async dismissAlert(userId: string, alertId: string): Promise<void> {
    const existingAlert = await prisma.alert.findFirst({
      where: {
        id: alertId,
        userId,
      },
    });

    if (!existingAlert) {
      throw new AppError('Alert not found', 404);
    }

    await prisma.alert.update({
      where: { id: alertId },
      data: {
        dismissedAt: new Date(),
      },
    });

    logger.info('Alert dismissed', {
      service: 'kitcha-api',
      userId,
      alertId,
    });
  }

  /**
   * Delete alert
   */
  async deleteAlert(userId: string, alertId: string): Promise<void> {
    const existingAlert = await prisma.alert.findFirst({
      where: {
        id: alertId,
        userId,
      },
    });

    if (!existingAlert) {
      throw new AppError('Alert not found', 404);
    }

    await prisma.alert.delete({
      where: { id: alertId },
    });

    logger.info('Alert deleted', {
      service: 'kitcha-api',
      userId,
      alertId,
    });
  }

  /**
   * Get budget status
   */
  async getBudgetStatus(userId: string): Promise<BudgetStatusResponse> {
    // Get user preferences
    const preferences = await prisma.userPreference.findUnique({
      where: { userId },
    });

    if (!preferences) {
      throw new AppError('User preferences not found', 404);
    }

    // Calculate current week boundaries
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + diffToMonday);
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    // Calculate spending this week from shopping history
    const shoppingHistory = await prisma.shoppingHistory.findMany({
      where: {
        userId,
        receiptDate: {
          gte: weekStart,
          lte: weekEnd,
        },
      },
    });

    const spentThisWeekCents = shoppingHistory.reduce(
      (sum, item) => sum + item.totalPhpCents,
      0
    );

    const weeklyBudgetCents = preferences.budgetPerWeekCents;
    const remainingCents = weeklyBudgetCents - spentThisWeekCents;
    const percentageUsed = (spentThisWeekCents / weeklyBudgetCents) * 100;

    // Determine status
    let status: 'healthy' | 'warning' | 'exceeded';
    if (percentageUsed >= 100) {
      status = 'exceeded';
    } else if (percentageUsed >= preferences.alertThresholdPercentage) {
      status = 'warning';
    } else {
      status = 'healthy';
    }

    // Check if alert needed
    if (status === 'exceeded' || status === 'warning') {
      await this.checkAndCreateBudgetAlert(
        userId,
        percentageUsed,
        preferences.alertThresholdPercentage,
        weeklyBudgetCents,
        spentThisWeekCents
      );
    }

    return {
      weeklyBudgetCents,
      spentThisWeekCents,
      remainingCents,
      percentageUsed: Math.round(percentageUsed * 100) / 100,
      status,
      weekStart: weekStart.toISOString().split('T')[0],
      weekEnd: weekEnd.toISOString().split('T')[0],
    };
  }

  /**
   * Check for expiring items and create alerts
   */
  async checkExpiringItems(userId: string): Promise<number> {
    const now = new Date();
    const threeDaysFromNow = new Date(now);
    threeDaysFromNow.setDate(now.getDate() + 3);

    // Find items expiring within 3 days
    const expiringItems = await prisma.pantryItem.findMany({
      where: {
        userId,
        deletedAt: null,
        expiryDate: {
          gte: now,
          lte: threeDaysFromNow,
        },
      },
    });

    let alertsCreated = 0;

    for (const item of expiringItems) {
      // Check if alert already exists for this item
      const existingAlert = await prisma.alert.findFirst({
        where: {
          userId,
          alertType: 'item_expiring',
          message: { contains: item.ingredientName },
          createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) }, // Last 24 hours
        },
      });

      if (!existingAlert) {
        const daysUntilExpiry = Math.ceil(
          (item.expiryDate!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        await this.createAlert(userId, {
          alertType: 'item_expiring',
          title: 'Item Expiring Soon',
          message: `${item.ingredientName} will expire in ${daysUntilExpiry} day(s)`,
          actualValue: daysUntilExpiry,
        });

        alertsCreated++;
      }
    }

    return alertsCreated;
  }

  /**
   * Get alert statistics
   */
  async getStats(userId: string): Promise<AlertStatsResponse> {
    const alerts = await prisma.alert.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const stats: AlertStatsResponse = {
      totalAlerts: alerts.length,
      unreadCount: alerts.filter((a) => !a.isRead).length,
      byType: {},
      recentAlerts: [],
    };

    // Count by type
    alerts.forEach((alert) => {
      stats.byType[alert.alertType] = (stats.byType[alert.alertType] || 0) + 1;
    });

    // Get 5 most recent alerts
    stats.recentAlerts = alerts
      .slice(0, 5)
      .map((alert) => this.formatAlert(alert));

    return stats;
  }

  /**
   * Check and create budget alert if needed
   */
  private async checkAndCreateBudgetAlert(
    userId: string,
    actualPercentage: number,
    threshold: number,
    budgetCents: number,
    spentCents: number
  ): Promise<void> {
    // Check if alert already exists today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingAlert = await prisma.alert.findFirst({
      where: {
        userId,
        alertType: 'budget_exceeded',
        createdAt: { gte: today },
      },
    });

    if (!existingAlert) {
      const title =
        actualPercentage >= 100
          ? 'Budget Exceeded'
          : 'Budget Threshold Reached';
      const message =
        actualPercentage >= 100
          ? `You have exceeded your weekly budget by ₱${((spentCents - budgetCents) / 100).toFixed(2)}`
          : `You have used ${actualPercentage.toFixed(1)}% of your weekly budget`;

      await this.createAlert(userId, {
        alertType: 'budget_exceeded',
        title,
        message,
        threshold,
        actualValue: Math.round(actualPercentage),
      });
    }
  }

  /**
   * Format alert for response
   */
  private formatAlert(alert: any): AlertResponse {
    return {
      id: alert.id,
      userId: alert.userId,
      alertType: alert.alertType,
      title: alert.title,
      message: alert.message,
      threshold: alert.threshold,
      actualValue: alert.actualValue,
      isRead: alert.isRead,
      readAt: alert.readAt?.toISOString(),
      dismissedAt: alert.dismissedAt?.toISOString(),
      createdAt: alert.createdAt.toISOString(),
    };
  }
}
