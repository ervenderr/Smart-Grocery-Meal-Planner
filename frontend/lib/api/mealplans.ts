import { apiClient } from './client';
import type {
  MealPlan,
  MealPlansResponse,
  CreateMealPlanData,
  UpdateMealPlanData,
  MealPlanStats,
  MealPlanShoppingList,
  MealPlanFilters,
} from '@/types/mealplan.types';

export const mealPlanApi = {
  /**
   * Get all meal plans with optional filters
   */
  async getAll(filters?: MealPlanFilters): Promise<MealPlansResponse> {
    const params = new URLSearchParams();

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, String(value));
        }
      });
    }

    const query = params.toString();
    const url = query ? `/api/v1/mealplans?${query}` : '/api/v1/mealplans';

    return await apiClient.get<MealPlansResponse>(url);
  },

  /**
   * Get meal plan statistics
   */
  async getStats(): Promise<MealPlanStats> {
    return await apiClient.get<MealPlanStats>('/api/v1/mealplans/stats');
  },

  /**
   * Get a single meal plan by ID
   */
  async getById(id: string): Promise<MealPlan> {
    return await apiClient.get<MealPlan>(`/api/v1/mealplans/${id}`);
  },

  /**
   * Create a new meal plan
   */
  async create(data: CreateMealPlanData): Promise<MealPlan> {
    return await apiClient.post<MealPlan>('/api/v1/mealplans', data);
  },

  /**
   * Update an existing meal plan
   */
  async update(id: string, data: UpdateMealPlanData): Promise<MealPlan> {
    return await apiClient.patch<MealPlan>(`/api/v1/mealplans/${id}`, data);
  },

  /**
   * Delete a meal plan
   */
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/v1/mealplans/${id}`);
  },

  /**
   * Generate shopping list from meal plan
   */
  async getShoppingList(id: string): Promise<MealPlanShoppingList> {
    return await apiClient.get<MealPlanShoppingList>(`/api/v1/mealplans/${id}/shopping-list`);
  },
};
