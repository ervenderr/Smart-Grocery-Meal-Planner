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
    const url = query ? `/mealplans?${query}` : '/mealplans';

    const response = await apiClient.get<MealPlansResponse>(url);
    return response.data;
  },

  /**
   * Get meal plan statistics
   */
  async getStats(): Promise<MealPlanStats> {
    const response = await apiClient.get<MealPlanStats>('/mealplans/stats');
    return response.data;
  },

  /**
   * Get a single meal plan by ID
   */
  async getById(id: string): Promise<MealPlan> {
    const response = await apiClient.get<MealPlan>(`/mealplans/${id}`);
    return response.data;
  },

  /**
   * Create a new meal plan
   */
  async create(data: CreateMealPlanData): Promise<MealPlan> {
    const response = await apiClient.post<MealPlan>('/mealplans', data);
    return response.data;
  },

  /**
   * Update an existing meal plan
   */
  async update(id: string, data: UpdateMealPlanData): Promise<MealPlan> {
    const response = await apiClient.patch<MealPlan>(`/mealplans/${id}`, data);
    return response.data;
  },

  /**
   * Delete a meal plan
   */
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/mealplans/${id}`);
  },

  /**
   * Generate shopping list from meal plan
   */
  async getShoppingList(id: string): Promise<MealPlanShoppingList> {
    const response = await apiClient.get<MealPlanShoppingList>(`/mealplans/${id}/shopping-list`);
    return response.data;
  },
};
