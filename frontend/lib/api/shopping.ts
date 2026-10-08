import { apiClient } from './client';
import { API_ROUTES } from '@/lib/constants/api-routes';
import type {
  ShoppingList,
  ShoppingItem,
  CreateShoppingItemInput,
  UpdateShoppingItemInput,
  GenerateShoppingListResult,
  FinishShoppingInput,
  FinishShoppingResult,
  ShoppingHistoryPage,
} from '@/types/shopping.types';

/**
 * Shopping API Service (/api/v1/shopping). Errors propagate to React Query.
 */
export const shoppingApi = {
  getActiveList: async (): Promise<ShoppingList> => {
    return apiClient.get<ShoppingList>(API_ROUTES.SHOPPING.LIST);
  },

  addItem: async (input: CreateShoppingItemInput): Promise<ShoppingItem> => {
    return apiClient.post<ShoppingItem>(API_ROUTES.SHOPPING.ITEMS, input);
  },

  updateItem: async (itemId: string, patch: UpdateShoppingItemInput): Promise<ShoppingItem> => {
    return apiClient.patch<ShoppingItem>(
      API_ROUTES.SHOPPING.ITEM(encodeURIComponent(itemId)),
      patch
    );
  },

  deleteItem: async (itemId: string): Promise<ShoppingItem> => {
    return apiClient.delete<ShoppingItem>(API_ROUTES.SHOPPING.ITEM(encodeURIComponent(itemId)));
  },

  generateFromMealPlan: async (mealPlanId: string): Promise<GenerateShoppingListResult> => {
    return apiClient.post<GenerateShoppingListResult>(API_ROUTES.SHOPPING.GENERATE, {
      mealPlanId,
    });
  },

  finish: async (input: FinishShoppingInput = {}): Promise<FinishShoppingResult> => {
    return apiClient.post<FinishShoppingResult>(API_ROUTES.SHOPPING.FINISH, input);
  },

  getHistory: async (params?: { page?: number; limit?: number }): Promise<ShoppingHistoryPage> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    const query = queryParams.toString();
    return apiClient.get<ShoppingHistoryPage>(
      `${API_ROUTES.SHOPPING.HISTORY}${query ? `?${query}` : ''}`
    );
  },
};
