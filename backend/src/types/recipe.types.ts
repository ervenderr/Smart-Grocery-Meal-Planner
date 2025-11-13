/**
 * Recipe Types
 *
 * TypeScript interfaces for recipe management.
 */

/**
 * Recipe difficulty levels
 */
export enum RecipeDifficulty {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard',
}

/**
 * Recipe categories
 */
export enum RecipeCategory {
  BREAKFAST = 'breakfast',
  LUNCH = 'lunch',
  DINNER = 'dinner',
  SNACK = 'snack',
  DESSERT = 'dessert',
  BEVERAGE = 'beverage',
}

/**
 * Dietary restrictions
 */
export enum DietaryRestriction {
  VEGETARIAN = 'vegetarian',
  VEGAN = 'vegan',
  GLUTEN_FREE = 'gluten_free',
  DAIRY_FREE = 'dairy_free',
  NUT_FREE = 'nut_free',
  HALAL = 'halal',
  KOSHER = 'kosher',
}

/**
 * Recipe ingredient (nested in recipe)
 */
export interface RecipeIngredient {
  ingredientName: string;
  quantity: number;
  unit: string;
  notes?: string;
}

/**
 * Request to create a new recipe
 */
export interface CreateRecipeRequest {
  name: string;
  description?: string;
  category: string;
  difficulty: string;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  servings: number;
  ingredients: RecipeIngredient[];
  instructions: string[];
  imageUrl?: string;
  tags?: string[];
  dietaryRestrictions?: string[];
  isPublic?: boolean;
}

/**
 * Request to update an existing recipe
 */
export interface UpdateRecipeRequest {
  name?: string;
  description?: string;
  category?: string;
  difficulty?: string;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  servings?: number;
  ingredients?: RecipeIngredient[];
  instructions?: string[];
  imageUrl?: string;
  tags?: string[];
  dietaryRestrictions?: string[];
  isPublic?: boolean;
}

/**
 * Recipe response (what the API returns)
 */
export interface RecipeResponse {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  category: string;
  difficulty: string;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  totalTimeMinutes: number; // Computed: prep + cook
  servings: number;
  ingredients: RecipeIngredient[];
  instructions: string[];
  imageUrl: string | null;
  tags: string[];
  dietaryRestrictions: string[];
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Query parameters for getting recipes
 */
export interface GetRecipesQuery {
  category?: string;
  difficulty?: string;
  dietaryRestriction?: string;
  maxPrepTime?: number; // Max prep time in minutes
  maxCookTime?: number; // Max cook time in minutes
  maxTotalTime?: number; // Max total time in minutes
  search?: string; // Search by name or description
  tags?: string; // Comma-separated tags
  includePublic?: boolean; // Include public recipes from other users
  sortBy?: 'name' | 'prepTime' | 'cookTime' | 'totalTime' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

/**
 * Paginated response
 */
export interface PaginatedRecipeResponse {
  items: RecipeResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Recipe statistics
 */
export interface RecipeStats {
  totalRecipes: number;
  byCategory: Record<string, number>;
  byDifficulty: Record<string, number>;
  averagePrepTime: number;
  averageCookTime: number;
  averageTotalTime: number;
}
