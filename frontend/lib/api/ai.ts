import { apiClient } from './client';

export interface RecipeSuggestion {
  name: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  ingredients: Array<{
    ingredientName: string;
    quantity: number;
    unit: string;
  }>;
  instructions: string[];
  matchPercentage: number;
}

export interface IngredientSubstitution {
  original: string;
  substitute: string;
  reason: string;
  estimatedSavingsPercent: number;
}

export interface MealPlanSuggestion {
  name: string;
  meals: Array<{
    day: number;
    mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    recipeName: string;
    ingredients: string[];
  }>;
  estimatedCostCents: number;
  totalCalories: number;
}

export interface AIStatus {
  available: boolean;
  provider: string;
  features: {
    recipeSuggestions: boolean;
    ingredientSubstitutions: boolean;
    mealPlanGeneration: boolean;
  };
}

export const aiApi = {
  /**
   * Check if AI service is available
   */
  async getStatus(): Promise<AIStatus> {
    return await apiClient.get<AIStatus>('/api/v1/ai/status');
  },

  /**
   * Get AI recipe suggestions based on pantry items
   * Note: AI requests can take 30-60 seconds
   */
  async suggestRecipes(params?: {
    usePantry?: boolean;
    dietaryRestrictions?: string[];
    maxPrepTime?: number;
  }): Promise<{ suggestions: RecipeSuggestion[]; pantryItemsUsed: number }> {
    return await apiClient.post('/api/v1/ai/suggest-recipes', params || {}, {
      timeout: 90000, // 90 seconds for AI generation
    });
  },

  /**
   * Get ingredient substitution suggestions
   */
  async suggestSubstitutions(
    ingredients: Array<{ ingredientName: string; quantity: number; unit: string }>,
    budgetCents?: number
  ): Promise<{ suggestions: IngredientSubstitution[] }> {
    return await apiClient.post('/api/v1/ai/suggest-substitutions', {
      ingredients,
      budgetCents,
    }, {
      timeout: 90000, // 90 seconds for AI generation
    });
  },

  /**
   * Generate a meal plan using AI
   */
  async generateMealPlan(params: {
    daysCount?: number;
    budgetCents: number;
    dietaryRestrictions?: string[];
    usePantry?: boolean;
  }): Promise<{ mealPlan: MealPlanSuggestion; pantryItemsUsed: number }> {
    return await apiClient.post('/api/v1/ai/generate-meal-plan', params, {
      timeout: 120000, // 120 seconds for meal plan generation
    });
  },
};
