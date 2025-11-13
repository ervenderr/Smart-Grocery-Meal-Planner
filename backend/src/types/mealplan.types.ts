/**
 * Meal Plan Types
 *
 * Type definitions for meal planning functionality.
 */

/**
 * Meal type enum
 */
export enum MealType {
  BREAKFAST = 'breakfast',
  LUNCH = 'lunch',
  DINNER = 'dinner',
  SNACK = 'snack',
}

/**
 * Day of week (0=Monday, 6=Sunday)
 */
export enum DayOfWeek {
  MONDAY = 0,
  TUESDAY = 1,
  WEDNESDAY = 2,
  THURSDAY = 3,
  FRIDAY = 4,
  SATURDAY = 5,
  SUNDAY = 6,
}

/**
 * Meal plan item for request
 */
export interface MealPlanItemInput {
  recipeId: string;
  dayOfWeek: number; // 0-6
  mealType: string;
  servings?: number;
}

/**
 * Meal plan item response
 */
export interface MealPlanItemResponse {
  id: string;
  recipeId: string;
  dayOfWeek: number;
  mealType: string;
  servings: number;
  costCents?: number;
  calories?: number;
  recipe?: {
    id: string;
    name: string;
    imageUrl?: string;
    prepTimeMinutes: number;
    cookTimeMinutes: number;
  };
}

/**
 * Create meal plan request
 */
export interface CreateMealPlanRequest {
  name: string;
  startDate: string; // ISO date string
  endDate: string; // ISO date string
  notes?: string;
  meals: MealPlanItemInput[];
}

/**
 * Update meal plan request
 */
export interface UpdateMealPlanRequest {
  name?: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
  isFavorite?: boolean;
  meals?: MealPlanItemInput[];
}

/**
 * Meal plan response
 */
export interface MealPlanResponse {
  id: string;
  userId: string;
  name: string;
  startDate: string;
  endDate: string;
  totalCostCents?: number;
  totalCalories?: number;
  isFavorite: boolean;
  notes?: string;
  meals: MealPlanItemResponse[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Query parameters for getting meal plans
 */
export interface GetMealPlansQuery {
  startDate?: string;
  endDate?: string;
  isFavorite?: boolean;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'startDate' | 'createdAt' | 'totalCost';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated meal plan response
 */
export interface PaginatedMealPlanResponse {
  items: MealPlanResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Meal plan statistics
 */
export interface MealPlanStats {
  totalMealPlans: number;
  averageCostCents: number;
  averageCalories: number;
  mealsByType: Record<string, number>;
  favoriteRecipes: Array<{
    recipeId: string;
    recipeName: string;
    usageCount: number;
  }>;
}

/**
 * Shopping list from meal plan
 */
export interface ShoppingListFromMealPlan {
  items: Array<{
    ingredientName: string;
    quantity: number;
    unit: string;
    recipes: string[]; // Recipe names that use this ingredient
  }>;
  totalEstimatedCostCents?: number;
}
