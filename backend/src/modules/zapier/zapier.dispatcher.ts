/**
 * Zapier Event Dispatcher
 *
 * Helper functions to dispatch Zapier events from various services.
 * This provides a clean interface for triggering webhooks from existing code.
 */

import { zapierService } from "./zapier.service";
import { logger } from "../../config/logger.config";
import {
  MealPlanEventPayload,
  GroceryListEventPayload,
  StockAlertPayload,
  ExpiryAlertPayload,
  BudgetAlertPayload,
  PurchaseLoggedPayload,
  WeeklySummaryPayload,
} from "./zapier.types";

/**
 * Dispatch meal plan created event
 */
export async function dispatchMealPlanCreated(
  userId: string,
  mealPlan: {
    id: string;
    name: string;
    startDate: Date;
    endDate: Date;
    totalMeals: number;
    estimatedCost?: number;
  },
  meals?: Array<{
    date: string;
    mealType: string;
    recipeName: string;
  }>
): Promise<void> {
  try {
    const payload: Omit<
      MealPlanEventPayload,
      "eventType" | "timestamp" | "userId"
    > = {
      mealPlan: {
        id: mealPlan.id,
        name: mealPlan.name,
        startDate: mealPlan.startDate.toISOString().split("T")[0],
        endDate: mealPlan.endDate.toISOString().split("T")[0],
        totalMeals: mealPlan.totalMeals,
        estimatedCost: mealPlan.estimatedCost,
      },
      meals,
    };

    await zapierService.dispatchEvent(userId, "meal_plan_created", payload);
  } catch (error) {
    logger.error("Failed to dispatch meal_plan_created event", {
      service: "kitcha-api",
      module: "zapier-dispatcher",
      userId,
      error: (error as Error).message,
    });
  }
}

/**
 * Dispatch meal plan updated event
 */
export async function dispatchMealPlanUpdated(
  userId: string,
  mealPlan: {
    id: string;
    name: string;
    startDate: Date;
    endDate: Date;
    totalMeals: number;
    estimatedCost?: number;
  }
): Promise<void> {
  try {
    const payload: Omit<
      MealPlanEventPayload,
      "eventType" | "timestamp" | "userId"
    > = {
      mealPlan: {
        id: mealPlan.id,
        name: mealPlan.name,
        startDate: mealPlan.startDate.toISOString().split("T")[0],
        endDate: mealPlan.endDate.toISOString().split("T")[0],
        totalMeals: mealPlan.totalMeals,
        estimatedCost: mealPlan.estimatedCost,
      },
    };

    await zapierService.dispatchEvent(userId, "meal_plan_updated", payload);
  } catch (error) {
    logger.error("Failed to dispatch meal_plan_updated event", {
      service: "kitcha-api",
      module: "zapier-dispatcher",
      userId,
      error: (error as Error).message,
    });
  }
}

/**
 * Dispatch grocery list generated event
 */
export async function dispatchGroceryListGenerated(
  userId: string,
  groceryList: {
    id: string;
    name: string;
    itemCount: number;
    estimatedTotal?: number;
  },
  items: Array<{
    ingredientName: string;
    quantity: number;
    unit: string;
    category?: string;
    estimatedPrice?: number;
  }>
): Promise<void> {
  try {
    const payload: Omit<
      GroceryListEventPayload,
      "eventType" | "timestamp" | "userId"
    > = {
      groceryList,
      items,
    };

    await zapierService.dispatchEvent(
      userId,
      "grocery_list_generated",
      payload
    );
  } catch (error) {
    logger.error("Failed to dispatch grocery_list_generated event", {
      service: "kitcha-api",
      module: "zapier-dispatcher",
      userId,
      error: (error as Error).message,
    });
  }
}

/**
 * Dispatch low stock alert
 */
export async function dispatchStockLow(
  userId: string,
  item: {
    id: string;
    ingredientName: string;
    currentQuantity: number;
    unit: string;
    category: string;
    location?: string;
  },
  threshold?: number
): Promise<void> {
  try {
    const payload: Omit<
      StockAlertPayload,
      "eventType" | "timestamp" | "userId"
    > = {
      item,
      threshold,
    };

    await zapierService.dispatchEvent(userId, "stock_low", payload);
  } catch (error) {
    logger.error("Failed to dispatch stock_low event", {
      service: "kitcha-api",
      module: "zapier-dispatcher",
      userId,
      error: (error as Error).message,
    });
  }
}

/**
 * Dispatch item expiring alert
 */
export async function dispatchItemExpiring(
  userId: string,
  item: {
    id: string;
    ingredientName: string;
    quantity: number;
    unit: string;
    expiryDate: Date;
    daysUntilExpiry: number;
    location?: string;
  }
): Promise<void> {
  try {
    const payload: Omit<
      ExpiryAlertPayload,
      "eventType" | "timestamp" | "userId"
    > = {
      item: {
        ...item,
        expiryDate: item.expiryDate.toISOString().split("T")[0],
      },
    };

    await zapierService.dispatchEvent(userId, "item_expiring", payload);
  } catch (error) {
    logger.error("Failed to dispatch item_expiring event", {
      service: "kitcha-api",
      module: "zapier-dispatcher",
      userId,
      error: (error as Error).message,
    });
  }
}

/**
 * Dispatch item expired alert
 */
export async function dispatchItemExpired(
  userId: string,
  item: {
    id: string;
    ingredientName: string;
    quantity: number;
    unit: string;
    expiryDate: Date;
    location?: string;
  }
): Promise<void> {
  try {
    const today = new Date();
    const expiryDate = new Date(item.expiryDate);
    const daysUntilExpiry = Math.floor(
      (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    const payload: Omit<
      ExpiryAlertPayload,
      "eventType" | "timestamp" | "userId"
    > = {
      item: {
        ...item,
        expiryDate: item.expiryDate.toISOString().split("T")[0],
        daysUntilExpiry,
      },
    };

    await zapierService.dispatchEvent(userId, "item_expired", payload);
  } catch (error) {
    logger.error("Failed to dispatch item_expired event", {
      service: "kitcha-api",
      module: "zapier-dispatcher",
      userId,
      error: (error as Error).message,
    });
  }
}

/**
 * Dispatch budget warning alert
 */
export async function dispatchBudgetWarning(
  userId: string,
  budget: {
    weeklyBudget: number;
    currentSpent: number;
    percentageUsed: number;
    remainingBudget: number;
    currency: string;
  }
): Promise<void> {
  try {
    const payload: Omit<
      BudgetAlertPayload,
      "eventType" | "timestamp" | "userId"
    > = {
      budget,
    };

    await zapierService.dispatchEvent(userId, "budget_warning", payload);
  } catch (error) {
    logger.error("Failed to dispatch budget_warning event", {
      service: "kitcha-api",
      module: "zapier-dispatcher",
      userId,
      error: (error as Error).message,
    });
  }
}

/**
 * Dispatch budget exceeded alert
 */
export async function dispatchBudgetExceeded(
  userId: string,
  budget: {
    weeklyBudget: number;
    currentSpent: number;
    percentageUsed: number;
    remainingBudget: number;
    currency: string;
  }
): Promise<void> {
  try {
    const payload: Omit<
      BudgetAlertPayload,
      "eventType" | "timestamp" | "userId"
    > = {
      budget,
    };

    await zapierService.dispatchEvent(userId, "budget_exceeded", payload);
  } catch (error) {
    logger.error("Failed to dispatch budget_exceeded event", {
      service: "kitcha-api",
      module: "zapier-dispatcher",
      userId,
      error: (error as Error).message,
    });
  }
}

/**
 * Dispatch purchase logged event
 */
export async function dispatchPurchaseLogged(
  userId: string,
  purchase: {
    id: string;
    storeName?: string;
    totalAmount: number;
    itemCount: number;
    purchaseDate: Date;
  },
  items: Array<{
    ingredientName: string;
    quantity: number;
    unit: string;
    price: number;
  }>
): Promise<void> {
  try {
    const payload: Omit<
      PurchaseLoggedPayload,
      "eventType" | "timestamp" | "userId"
    > = {
      purchase: {
        ...purchase,
        purchaseDate: purchase.purchaseDate.toISOString().split("T")[0],
      },
      items,
    };

    await zapierService.dispatchEvent(userId, "purchase_logged", payload);
  } catch (error) {
    logger.error("Failed to dispatch purchase_logged event", {
      service: "kitcha-api",
      module: "zapier-dispatcher",
      userId,
      error: (error as Error).message,
    });
  }
}

/**
 * Dispatch weekly summary event
 */
export async function dispatchWeeklySummary(
  userId: string,
  summary: {
    weekStartDate: Date;
    weekEndDate: Date;
    totalSpent: number;
    budgetLimit: number;
    budgetRemaining: number;
    mealsPlanned: number;
    mealsCompleted: number;
    itemsExpired: number;
    itemsUsed: number;
    topCategories: Array<{
      category: string;
      spent: number;
      percentage: number;
    }>;
  }
): Promise<void> {
  try {
    const payload: Omit<
      WeeklySummaryPayload,
      "eventType" | "timestamp" | "userId"
    > = {
      summary: {
        ...summary,
        weekStartDate: summary.weekStartDate.toISOString().split("T")[0],
        weekEndDate: summary.weekEndDate.toISOString().split("T")[0],
      },
    };

    await zapierService.dispatchEvent(userId, "weekly_summary", payload);
  } catch (error) {
    logger.error("Failed to dispatch weekly_summary event", {
      service: "kitcha-api",
      module: "zapier-dispatcher",
      userId,
      error: (error as Error).message,
    });
  }
}
