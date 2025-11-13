/**
 * Meal Plan Types
 */

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Monday, 6 = Sunday

export interface MealPlanItem {
  id: string;
  mealPlanId: string;
  recipeId: string;
  dayOfWeek: DayOfWeek;
  mealType: MealType;
  servings: number;
  costCents: number | null;
  calories: number | null;
  createdAt: string;
  updatedAt: string;
  recipe?: {
    id: string;
    name: string;
    imageUrl?: string | null;
    prepTimeMinutes: number;
    cookTimeMinutes: number;
  };
}

export interface MealPlan {
  id: string;
  userId: string;
  name: string;
  startDate: string;
  endDate: string;
  totalCostCents: number | null;
  totalCalories: number | null;
  isFavorite: boolean;
  notes: string | null;
  meals: MealPlanItem[];
  createdAt: string;
  updatedAt: string;
}

export interface MealPlanItemInput {
  recipeId: string;
  dayOfWeek: DayOfWeek;
  mealType: MealType;
  servings?: number;
}

export interface CreateMealPlanData {
  name: string;
  startDate: string;
  endDate: string;
  notes?: string;
  meals: MealPlanItemInput[];
}

export interface UpdateMealPlanData {
  name?: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
  isFavorite?: boolean;
  meals?: MealPlanItemInput[];
}

export interface MealPlansResponse {
  items: MealPlan[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

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

export interface ShoppingListItem {
  ingredientName: string;
  quantity: number;
  unit: string;
  recipes: string[];
}

export interface MealPlanShoppingList {
  items: ShoppingListItem[];
  totalEstimatedCostCents: number | null;
}

export interface MealPlanFilters {
  startDate?: string;
  endDate?: string;
  isFavorite?: boolean;
  sortBy?: 'name' | 'startDate' | 'createdAt' | 'totalCost';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}
