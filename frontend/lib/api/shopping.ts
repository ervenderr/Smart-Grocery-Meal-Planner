import { apiClient } from './client';
import type {
  ShoppingList,
  ShoppingListsResponse,
  CreateShoppingListData,
  UpdateShoppingListData,
  UpdateShoppingListItemData,
  ShoppingListFilters,
} from '@/types/shopping.types';

export const shoppingListApi = {
  /**
   * Get all shopping lists with optional filters
   * Note: This endpoint may not be implemented yet on backend
   */
  async getAll(filters?: ShoppingListFilters): Promise<ShoppingListsResponse> {
    const params = new URLSearchParams();

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, String(value));
        }
      });
    }

    const query = params.toString();
    const url = query ? `/api/v1/shopping-lists?${query}` : '/api/v1/shopping-lists';

    return await apiClient.get<ShoppingListsResponse>(url);
  },

  /**
   * Get a single shopping list by ID
   */
  async getById(id: string): Promise<ShoppingList> {
    return await apiClient.get<ShoppingList>(`/api/v1/shopping-lists/${id}`);
  },

  /**
   * Create a new shopping list
   */
  async create(data: CreateShoppingListData): Promise<ShoppingList> {
    return await apiClient.post<ShoppingList>('/api/v1/shopping-lists', data);
  },

  /**
   * Update an existing shopping list
   */
  async update(id: string, data: UpdateShoppingListData): Promise<ShoppingList> {
    return await apiClient.patch<ShoppingList>(`/api/v1/shopping-lists/${id}`, data);
  },

  /**
   * Delete a shopping list
   */
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/v1/shopping-lists/${id}`);
  },

  /**
   * Mark shopping list as completed
   */
  async complete(id: string): Promise<ShoppingList> {
    return await apiClient.patch<ShoppingList>(`/api/v1/shopping-lists/${id}`, {
      isCompleted: true,
    });
  },

  /**
   * Update a shopping list item
   */
  async updateItem(
    listId: string,
    itemId: string,
    data: UpdateShoppingListItemData
  ): Promise<ShoppingList> {
    return await apiClient.patch<ShoppingList>(
      `/api/v1/shopping-lists/${listId}/items/${itemId}`,
      data
    );
  },

  /**
   * Delete a shopping list item
   */
  async deleteItem(listId: string, itemId: string): Promise<void> {
    await apiClient.delete(`/api/v1/shopping-lists/${listId}/items/${itemId}`);
  },
};
