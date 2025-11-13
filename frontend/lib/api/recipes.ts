import { apiClient } from './client';
import type {
  Recipe,
  RecipesResponse,
  CreateRecipeData,
  UpdateRecipeData,
  RecipeStats,
  RecipeFilters,
} from '@/types/recipe.types';

export const recipeApi = {
  /**
   * Get all recipes with optional filters
   */
  async getAll(filters?: RecipeFilters): Promise<RecipesResponse> {
    const params = new URLSearchParams();

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, String(value));
        }
      });
    }

    const query = params.toString();
    const url = query ? `/recipes?${query}` : '/recipes';

    const response = await apiClient.get<RecipesResponse>(url);
    return response.data;
  },

  /**
   * Get recipe statistics
   */
  async getStats(): Promise<RecipeStats> {
    const response = await apiClient.get<RecipeStats>('/recipes/stats');
    return response.data;
  },

  /**
   * Get a single recipe by ID
   */
  async getById(id: string): Promise<Recipe> {
    const response = await apiClient.get<Recipe>(`/recipes/${id}`);
    return response.data;
  },

  /**
   * Create a new recipe
   */
  async create(data: CreateRecipeData): Promise<Recipe> {
    const response = await apiClient.post<Recipe>('/recipes', data);
    return response.data;
  },

  /**
   * Update an existing recipe
   */
  async update(id: string, data: UpdateRecipeData): Promise<Recipe> {
    const response = await apiClient.patch<Recipe>(`/recipes/${id}`, data);
    return response.data;
  },

  /**
   * Delete a recipe
   */
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/recipes/${id}`);
  },
};
