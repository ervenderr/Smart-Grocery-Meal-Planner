/**
 * Zapier Scheduler
 *
 * Scheduled tasks for triggering Zapier events at specific intervals.
 * Uses node-cron for scheduling.
 *
 * SCHEDULES:
 * - Weekly Summary: Every Sunday at 11 PM
 * - Daily Checks: Every day at 8 AM (expiry alerts, budget checks)
 */

import { prisma } from "../../config/database.config";
import { logger } from "../../config/logger.config";
import {
  dispatchWeeklySummary,
  dispatchItemExpiring,
} from "./zapier.dispatcher";

/**
 * Calculate the start of the current week (Monday)
 */
function getWeekStart(): Date {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - ((dayOfWeek + 6) % 7));
  startOfWeek.setHours(0, 0, 0, 0);
  return startOfWeek;
}

/**
 * Calculate the end of the current week (Sunday)
 */
function getWeekEnd(): Date {
  const startOfWeek = getWeekStart();
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  return endOfWeek;
}

/**
 * Generate and dispatch weekly summary for all active users
 */
export async function runWeeklySummaryJob(): Promise<void> {
  logger.info("Starting weekly summary job", {
    service: "kitcha-api",
    module: "zapier-scheduler",
  });

  try {
    // Get all active users with webhooks configured for weekly_summary
    const usersWithWebhooks = await prisma.zapierWebhook.findMany({
      where: {
        eventType: "weekly_summary",
        isActive: true,
      },
      select: {
        userId: true,
      },
      distinct: ["userId"],
    });

    // Also include users if global webhook is configured
    const globalWebhookUrl = process.env.ZAPIER_WEBHOOK_URL;
    let usersToProcess: string[] = usersWithWebhooks.map((w) => w.userId);

    // If global webhook exists, process all active users
    if (globalWebhookUrl) {
      const allActiveUsers = await prisma.user.findMany({
        where: { isActive: true },
        select: { id: true },
      });
      usersToProcess = [
        ...new Set([...usersToProcess, ...allActiveUsers.map((u) => u.id)]),
      ];
    }

    const weekStart = getWeekStart();
    const weekEnd = getWeekEnd();

    for (const userId of usersToProcess) {
      try {
        // Get user preferences
        const preferences = await prisma.userPreference.findUnique({
          where: { userId },
        });

        // Calculate spending
        const spending = await prisma.shoppingHistory.aggregate({
          where: {
            userId,
            receiptDate: {
              gte: weekStart,
              lte: weekEnd,
            },
          },
          _sum: {
            totalPhpCents: true,
          },
        });

        // Count meal plan items
        const mealPlans = await prisma.mealPlan.findMany({
          where: {
            userId,
            startDate: {
              gte: weekStart,
            },
            endDate: {
              lte: weekEnd,
            },
            deletedAt: null,
          },
          include: {
            mealPlanItems: true,
          },
        });

        const mealsPlanned = mealPlans.reduce(
          (acc, mp) => acc + mp.mealPlanItems.length,
          0
        );

        // Count expired items this week
        const expiredItems = await prisma.pantryItem.count({
          where: {
            userId,
            deletedAt: null,
            expiryDate: {
              gte: weekStart,
              lte: weekEnd,
            },
          },
        });

        // Get category spending breakdown
        const shoppingItems = await prisma.shoppingListItem.findMany({
          where: {
            shoppingList: {
              userId,
              completedAt: {
                gte: weekStart,
                lte: weekEnd,
              },
            },
          },
          select: {
            category: true,
            actualCostCents: true,
          },
        });

        const categorySpending = shoppingItems.reduce(
          (acc: Record<string, number>, item) => {
            const category = item.category || "other";
            acc[category] = (acc[category] || 0) + (item.actualCostCents || 0);
            return acc;
          },
          {}
        );

        const totalSpent = spending._sum.totalPhpCents || 0;
        const budgetLimit = preferences?.budgetPerWeekCents || 10000;

        const topCategories = Object.entries(categorySpending)
          .map(([category, spent]) => ({
            category,
            spent,
            percentage:
              totalSpent > 0 ? Math.round((spent / totalSpent) * 100) : 0,
          }))
          .sort((a, b) => b.spent - a.spent)
          .slice(0, 5);

        await dispatchWeeklySummary(userId, {
          weekStartDate: weekStart,
          weekEndDate: weekEnd,
          totalSpent,
          budgetLimit,
          budgetRemaining: budgetLimit - totalSpent,
          mealsPlanned,
          mealsCompleted: mealsPlanned, // TODO: Track actual completion
          itemsExpired: expiredItems,
          itemsUsed: 0, // TODO: Track items used from pantry
          topCategories,
        });

        logger.debug("Weekly summary dispatched for user", {
          service: "kitcha-api",
          module: "zapier-scheduler",
          userId,
        });
      } catch (userError) {
        logger.error("Failed to generate weekly summary for user", {
          service: "kitcha-api",
          module: "zapier-scheduler",
          userId,
          error: (userError as Error).message,
        });
      }
    }

    logger.info("Weekly summary job completed", {
      service: "kitcha-api",
      module: "zapier-scheduler",
      usersProcessed: usersToProcess.length,
    });
  } catch (error) {
    logger.error("Weekly summary job failed", {
      service: "kitcha-api",
      module: "zapier-scheduler",
      error: (error as Error).message,
    });
  }
}

/**
 * Run daily checks for expiring items and budget warnings
 */
export async function runDailyChecksJob(): Promise<void> {
  logger.info("Starting daily checks job", {
    service: "kitcha-api",
    module: "zapier-scheduler",
  });

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    // Get users with expiring items
    const expiringItems = await prisma.pantryItem.findMany({
      where: {
        deletedAt: null,
        expiryDate: {
          gte: today,
          lte: threeDaysFromNow,
        },
      },
      include: {
        user: {
          select: { id: true },
        },
      },
    });

    // Group by user
    const itemsByUser = expiringItems.reduce(
      (acc: Record<string, typeof expiringItems>, item) => {
        const userId = item.userId;
        if (!acc[userId]) {
          acc[userId] = [];
        }
        acc[userId].push(item);
        return acc;
      },
      {}
    );

    // Dispatch expiring item alerts
    for (const [userId, items] of Object.entries(itemsByUser)) {
      for (const item of items) {
        const expiryDate = new Date(item.expiryDate!);
        const daysUntilExpiry = Math.ceil(
          (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );

        await dispatchItemExpiring(userId, {
          id: item.id,
          ingredientName: item.ingredientName,
          quantity: Number(item.quantity),
          unit: item.unit,
          expiryDate: expiryDate,
          daysUntilExpiry,
          location: item.location || undefined,
        });
      }
    }

    logger.info("Daily checks job completed", {
      service: "kitcha-api",
      module: "zapier-scheduler",
      expiringItemsProcessed: expiringItems.length,
    });
  } catch (error) {
    logger.error("Daily checks job failed", {
      service: "kitcha-api",
      module: "zapier-scheduler",
      error: (error as Error).message,
    });
  }
}

/**
 * Initialize the scheduler (call this from index.ts)
 * Uses node-cron syntax:
 * - second (optional), minute, hour, day of month, month, day of week
 *
 * Note: Requires 'node-cron' package to be installed
 */
export function initializeScheduler(): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const cron = require("node-cron");

    // Weekly Summary - Every Sunday at 11 PM
    cron.schedule("0 23 * * 0", () => {
      runWeeklySummaryJob();
    });

    // Daily Checks - Every day at 8 AM
    cron.schedule("0 8 * * *", () => {
      runDailyChecksJob();
    });

    logger.info("Zapier scheduler initialized", {
      service: "kitcha-api",
      module: "zapier-scheduler",
      schedules: [
        "Weekly Summary: Sunday at 11 PM",
        "Daily Checks: Every day at 8 AM",
      ],
    });
  } catch (error) {
    logger.warn(
      "node-cron not installed, scheduler disabled. Install with: npm install node-cron",
      {
        service: "kitcha-api",
        module: "zapier-scheduler",
      }
    );
  }
}
