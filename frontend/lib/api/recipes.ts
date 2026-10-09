import { apiClient } from './client';
import type {
  Recipe,
  RecipesResponse,
  CreateRecipeData,
  UpdateRecipeData,
  RecipeStats,
  RecipeFilters,
} from '@/types/recipe.types';

import { normalizeCookFirst, type CookFirstResult } from '@/lib/recipes/cook-first';

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
    const url = query ? `/api/v1/recipes?${query}` : '/api/v1/recipes';

    return await apiClient.get<RecipesResponse>(url);
  },

  /**
   * Get recipe statistics
   */
  async getStats(): Promise<RecipeStats> {
    return await apiClient.get<RecipeStats>('/api/v1/recipes/stats');
  },

  /**
   * Rank recipes by soon-to-expire pantry usage (cook this first)
   */
  async getCookFirst(opts: {
    limit?: number;
    today: string;
    includeAll?: boolean;
  }): Promise<CookFirstResult> {
    const params = new URLSearchParams({ today: opts.today });
    params.set('includeAll', String(Boolean(opts.includeAll)));
    if (!opts.includeAll && opts.limit !== undefined) {
      params.set('limit', String(opts.limit));
    }
    const raw = await apiClient.get<unknown>(`/api/v1/recipes/cook-first?${params.toString()}`);
    return normalizeCookFirst(raw);
  },

  /**
   * Get a single recipe by ID
   */
  async getById(id: string): Promise<Recipe> {
    return await apiClient.get<Recipe>(`/api/v1/recipes/${id}`);
  },

  /**
   * Create a new recipe
   */
  async create(data: CreateRecipeData): Promise<Recipe> {
    return await apiClient.post<Recipe>('/api/v1/recipes', data);
  },

  /**
   * Update an existing recipe
   */
  async update(id: string, data: UpdateRecipeData): Promise<Recipe> {
    return await apiClient.patch<Recipe>(`/api/v1/recipes/${id}`, data);
  },

  /**
   * Delete a recipe
   */
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/v1/recipes/${id}`);
  },
};
