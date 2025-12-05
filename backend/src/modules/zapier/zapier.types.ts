/**
 * Zapier Integration Types
 *
 * Type definitions for Zapier webhook events and payloads
 */

// ============================================
// Event Types
// ============================================

export type ZapierEventType =
  | "meal_plan_created"
  | "meal_plan_updated"
  | "grocery_list_generated"
  | "stock_low"
  | "item_expiring"
  | "item_expired"
  | "budget_warning"
  | "budget_exceeded"
  | "purchase_logged"
  | "weekly_summary";

// ============================================
// Webhook Configuration
// ============================================

export interface ZapierWebhookConfig {
  id: string;
  userId: string;
  eventType: ZapierEventType;
  webhookUrl: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateWebhookRequest {
  eventType: ZapierEventType;
  webhookUrl: string;
}

export interface UpdateWebhookRequest {
  webhookUrl?: string;
  isActive?: boolean;
}

// ============================================
// Event Payloads
// ============================================

export interface BaseEventPayload {
  eventType: ZapierEventType;
  timestamp: string;
  userId: string;
  userEmail?: string;
}

export interface MealPlanEventPayload extends BaseEventPayload {
  eventType: "meal_plan_created" | "meal_plan_updated";
  mealPlan: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    totalMeals: number;
    estimatedCost?: number;
  };
  meals?: Array<{
    date: string;
    mealType: string;
    recipeName: string;
  }>;
}

export interface GroceryListEventPayload extends BaseEventPayload {
  eventType: "grocery_list_generated";
  groceryList: {
    id: string;
    name: string;
    itemCount: number;
    estimatedTotal?: number;
  };
  items: Array<{
    ingredientName: string;
    quantity: number;
    unit: string;
    category?: string;
    estimatedPrice?: number;
  }>;
}

export interface StockAlertPayload extends BaseEventPayload {
  eventType: "stock_low";
  item: {
    id: string;
    ingredientName: string;
    currentQuantity: number;
    unit: string;
    category: string;
    location?: string;
  };
  threshold?: number;
}

export interface ExpiryAlertPayload extends BaseEventPayload {
  eventType: "item_expiring" | "item_expired";
  item: {
    id: string;
    ingredientName: string;
    quantity: number;
    unit: string;
    expiryDate: string;
    daysUntilExpiry: number;
    location?: string;
  };
}

export interface BudgetAlertPayload extends BaseEventPayload {
  eventType: "budget_warning" | "budget_exceeded";
  budget: {
    weeklyBudget: number;
    currentSpent: number;
    percentageUsed: number;
    remainingBudget: number;
    currency: string;
  };
}

export interface PurchaseLoggedPayload extends BaseEventPayload {
  eventType: "purchase_logged";
  purchase: {
    id: string;
    storeName?: string;
    totalAmount: number;
    itemCount: number;
    purchaseDate: string;
  };
  items: Array<{
    ingredientName: string;
    quantity: number;
    unit: string;
    price: number;
  }>;
}

export interface WeeklySummaryPayload extends BaseEventPayload {
  eventType: "weekly_summary";
  summary: {
    weekStartDate: string;
    weekEndDate: string;
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
  };
}

export type ZapierEventPayload =
  | MealPlanEventPayload
  | GroceryListEventPayload
  | StockAlertPayload
  | ExpiryAlertPayload
  | BudgetAlertPayload
  | PurchaseLoggedPayload
  | WeeklySummaryPayload;

// ============================================
// Webhook Response
// ============================================

export interface WebhookDispatchResult {
  success: boolean;
  eventType: ZapierEventType;
  webhookUrl?: string;
  statusCode?: number;
  error?: string;
  timestamp: string;
}

export interface WebhookDispatchSummary {
  eventType: ZapierEventType;
  totalDispatched: number;
  successful: number;
  failed: number;
  results: WebhookDispatchResult[];
}

// ============================================
// Webhook Log (for tracking/debugging)
// ============================================

export interface WebhookLogEntry {
  id: string;
  userId: string;
  eventType: ZapierEventType;
  webhookUrl: string;
  payload: string;
  statusCode?: number;
  responseTime?: number;
  success: boolean;
  errorMessage?: string;
  createdAt: Date;
}
