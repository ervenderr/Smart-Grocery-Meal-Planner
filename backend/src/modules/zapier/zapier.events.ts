/**
 * Zapier Event Definitions
 *
 * Centralized event type definitions and metadata
 */

import { ZapierEventType } from "./zapier.types";

export interface EventDefinition {
  type: ZapierEventType;
  name: string;
  description: string;
  category: "meal_planning" | "inventory" | "budget" | "shopping" | "analytics";
  priority: "low" | "normal" | "high";
  samplePayload: Record<string, unknown>;
}

export const ZAPIER_EVENTS: Record<ZapierEventType, EventDefinition> = {
  meal_plan_created: {
    type: "meal_plan_created",
    name: "Meal Plan Created",
    description: "Triggered when a user creates a new meal plan",
    category: "meal_planning",
    priority: "high",
    samplePayload: {
      eventType: "meal_plan_created",
      timestamp: "2025-12-05T10:00:00Z",
      userId: "user-123",
      mealPlan: {
        id: "plan-456",
        name: "Weekly Meal Plan",
        startDate: "2025-12-06",
        endDate: "2025-12-12",
        totalMeals: 21,
        estimatedCost: 5000,
      },
    },
  },

  meal_plan_updated: {
    type: "meal_plan_updated",
    name: "Meal Plan Updated",
    description: "Triggered when a user updates an existing meal plan",
    category: "meal_planning",
    priority: "normal",
    samplePayload: {
      eventType: "meal_plan_updated",
      timestamp: "2025-12-05T10:00:00Z",
      userId: "user-123",
      mealPlan: {
        id: "plan-456",
        name: "Updated Weekly Plan",
        startDate: "2025-12-06",
        endDate: "2025-12-12",
        totalMeals: 21,
      },
    },
  },

  grocery_list_generated: {
    type: "grocery_list_generated",
    name: "Grocery List Generated",
    description:
      "Triggered when a shopping/grocery list is generated from a meal plan",
    category: "shopping",
    priority: "high",
    samplePayload: {
      eventType: "grocery_list_generated",
      timestamp: "2025-12-05T10:00:00Z",
      userId: "user-123",
      groceryList: {
        id: "list-789",
        name: "Weekly Groceries",
        itemCount: 15,
        estimatedTotal: 3500,
      },
      items: [
        {
          ingredientName: "Chicken Breast",
          quantity: 1,
          unit: "kg",
          category: "protein",
        },
        { ingredientName: "Rice", quantity: 2, unit: "kg", category: "grains" },
      ],
    },
  },

  stock_low: {
    type: "stock_low",
    name: "Low Stock Alert",
    description: "Triggered when a pantry item falls below threshold quantity",
    category: "inventory",
    priority: "normal",
    samplePayload: {
      eventType: "stock_low",
      timestamp: "2025-12-05T10:00:00Z",
      userId: "user-123",
      item: {
        id: "item-111",
        ingredientName: "Eggs",
        currentQuantity: 2,
        unit: "pieces",
        category: "dairy",
        location: "fridge",
      },
      threshold: 6,
    },
  },

  item_expiring: {
    type: "item_expiring",
    name: "Item Expiring Soon",
    description:
      "Triggered when a pantry item is about to expire (within 3-7 days)",
    category: "inventory",
    priority: "high",
    samplePayload: {
      eventType: "item_expiring",
      timestamp: "2025-12-05T10:00:00Z",
      userId: "user-123",
      item: {
        id: "item-222",
        ingredientName: "Milk",
        quantity: 1,
        unit: "liter",
        expiryDate: "2025-12-08",
        daysUntilExpiry: 3,
        location: "fridge",
      },
    },
  },

  item_expired: {
    type: "item_expired",
    name: "Item Expired",
    description: "Triggered when a pantry item has expired",
    category: "inventory",
    priority: "high",
    samplePayload: {
      eventType: "item_expired",
      timestamp: "2025-12-05T10:00:00Z",
      userId: "user-123",
      item: {
        id: "item-333",
        ingredientName: "Yogurt",
        quantity: 2,
        unit: "cups",
        expiryDate: "2025-12-04",
        daysUntilExpiry: -1,
        location: "fridge",
      },
    },
  },

  budget_warning: {
    type: "budget_warning",
    name: "Budget Warning",
    description: "Triggered when spending reaches 80% of weekly budget",
    category: "budget",
    priority: "normal",
    samplePayload: {
      eventType: "budget_warning",
      timestamp: "2025-12-05T10:00:00Z",
      userId: "user-123",
      budget: {
        weeklyBudget: 10000,
        currentSpent: 8500,
        percentageUsed: 85,
        remainingBudget: 1500,
        currency: "PHP",
      },
    },
  },

  budget_exceeded: {
    type: "budget_exceeded",
    name: "Budget Exceeded",
    description: "Triggered when spending exceeds the weekly budget",
    category: "budget",
    priority: "high",
    samplePayload: {
      eventType: "budget_exceeded",
      timestamp: "2025-12-05T10:00:00Z",
      userId: "user-123",
      budget: {
        weeklyBudget: 10000,
        currentSpent: 11500,
        percentageUsed: 115,
        remainingBudget: -1500,
        currency: "PHP",
      },
    },
  },

  purchase_logged: {
    type: "purchase_logged",
    name: "Purchase Logged",
    description: "Triggered when a shopping purchase is logged/completed",
    category: "shopping",
    priority: "normal",
    samplePayload: {
      eventType: "purchase_logged",
      timestamp: "2025-12-05T10:00:00Z",
      userId: "user-123",
      purchase: {
        id: "purchase-444",
        storeName: "SM Supermarket",
        totalAmount: 2500,
        itemCount: 8,
        purchaseDate: "2025-12-05",
      },
      items: [
        { ingredientName: "Chicken", quantity: 1, unit: "kg", price: 250 },
      ],
    },
  },

  weekly_summary: {
    type: "weekly_summary",
    name: "Weekly Summary Report",
    description: "Scheduled weekly summary of spending, meals, and inventory",
    category: "analytics",
    priority: "low",
    samplePayload: {
      eventType: "weekly_summary",
      timestamp: "2025-12-05T23:00:00Z",
      userId: "user-123",
      summary: {
        weekStartDate: "2025-11-29",
        weekEndDate: "2025-12-05",
        totalSpent: 8500,
        budgetLimit: 10000,
        budgetRemaining: 1500,
        mealsPlanned: 21,
        mealsCompleted: 18,
        itemsExpired: 2,
        itemsUsed: 25,
        topCategories: [
          { category: "protein", spent: 3000, percentage: 35 },
          { category: "vegetables", spent: 2000, percentage: 24 },
        ],
      },
    },
  },
};

/**
 * Get all available event types
 */
export function getAvailableEventTypes(): ZapierEventType[] {
  return Object.keys(ZAPIER_EVENTS) as ZapierEventType[];
}

/**
 * Get event definition by type
 */
export function getEventDefinition(
  eventType: ZapierEventType
): EventDefinition | undefined {
  return ZAPIER_EVENTS[eventType];
}

/**
 * Get events by category
 */
export function getEventsByCategory(
  category: EventDefinition["category"]
): EventDefinition[] {
  return Object.values(ZAPIER_EVENTS).filter(
    (event) => event.category === category
  );
}
