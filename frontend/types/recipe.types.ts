/**
 * Recipe Types
 */

export type RecipeCategory =
  | 'breakfast'
  | 'lunch'
  | 'dinner'
  | 'snack'
  | 'dessert'
  | 'beverage';

export type RecipeDifficulty =
  | 'easy'
  | 'medium'
  | 'hard';

export type DietaryRestriction =
  | 'vegetarian'
  | 'vegan'
  | 'gluten_free'
  | 'dairy_free'
  | 'nut_free'
  | 'halal'
  | 'kosher';

export type RecipeIngredientUnit =
  | 'lbs' | 'kg' | 'grams' | 'oz'
  | 'cups' | 'ml' | 'liters' | 'tsp' | 'tbsp' | 'fl_oz'
  | 'pieces' | 'items';

export interface RecipeIngredient {
  ingredientName: string;
  quantity: number;
  unit: RecipeIngredientUnit;
  notes?: string;
}

export interface Recipe {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  category: RecipeCategory;
  difficulty: RecipeDifficulty;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  totalTimeMinutes: number;
  servings: number;
  ingredients: RecipeIngredient[];
  instructions: string[];
  imageUrl: string | null;
  tags: string[];
  dietaryRestrictions: DietaryRestriction[];
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRecipeData {
  name: string;
  description?: string;
  category: RecipeCategory;
  difficulty: RecipeDifficulty;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  servings: number;
  ingredients: RecipeIngredient[];
  instructions: string[];
  imageUrl?: string;
  tags?: string[];
  dietaryRestrictions?: DietaryRestriction[];
  isPublic?: boolean;
}

export interface UpdateRecipeData {
  name?: string;
  description?: string;
  category?: RecipeCategory;
  difficulty?: RecipeDifficulty;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  servings?: number;
  ingredients?: RecipeIngredient[];
  instructions?: string[];
  imageUrl?: string;
  tags?: string[];
  dietaryRestrictions?: DietaryRestriction[];
  isPublic?: boolean;
}

export interface RecipesResponse {
  items: Recipe[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface RecipeStats {
  totalRecipes: number;
  byCategory: Record<string, number>;
  byDifficulty: Record<string, number>;
  averagePrepTime: number;
  averageCookTime: number;
  averageTotalTime: number;
}

export interface RecipeFilters {
  category?: RecipeCategory;
  difficulty?: RecipeDifficulty;
  dietaryRestriction?: DietaryRestriction;
  maxPrepTime?: number;
  maxCookTime?: number;
  maxTotalTime?: number;
  search?: string;
  tags?: string;
  includePublic?: boolean;
  sortBy?: 'name' | 'prepTime' | 'cookTime' | 'totalTime' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}
