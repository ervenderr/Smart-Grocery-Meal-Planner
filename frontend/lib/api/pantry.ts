import { apiClient } from './client';
import { API_ROUTES } from '@/lib/constants/api-routes';
import type {
  PantryItem,
  CreatePantryItemData,
  UpdatePantryItemData,
  PantryItemsResponse,
  ExpiringItem,
} from '@/types/pantry.types';

/**
 * Pantry API Service
 */
export const pantryApi = {
  /**
   * Get all pantry items
   */
  getAll: async (params?: {
    page?: number;
    limit?: number;
    category?: string;
    search?: string;
  }): Promise<PantryItemsResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.category) queryParams.append('category', params.category);
    if (params?.search) queryParams.append('search', params.search);

    const url = `${API_ROUTES.PANTRY.BASE}${queryParams.toString() ? `?${queryParams}` : ''}`;
    return apiClient.get<PantryItemsResponse>(url);
  },

  /**
   * Get single pantry item by ID
   */
  getById: async (id: string): Promise<PantryItem> => {
    return apiClient.get<PantryItem>(API_ROUTES.PANTRY.BY_ID(id));
  },

  /**
   * Create new pantry item
   */
  create: async (data: CreatePantryItemData): Promise<PantryItem> => {
    return apiClient.post<PantryItem>(API_ROUTES.PANTRY.BASE, data);
  },

  /**
   * Update pantry item
   */
  update: async (id: string, data: UpdatePantryItemData): Promise<PantryItem> => {
    return apiClient.patch<PantryItem>(API_ROUTES.PANTRY.BY_ID(id), data);
  },

  /**
   * Delete pantry item
   */
  delete: async (id: string): Promise<void> => {
    return apiClient.delete<void>(API_ROUTES.PANTRY.BY_ID(id));
  },

  /**
   * Get items expiring soon
   */
  getExpiringSoon: async (days?: number): Promise<ExpiringItem[]> => {
    const url = `${API_ROUTES.PANTRY.EXPIRING_SOON}${days ? `?days=${days}` : ''}`;
    return apiClient.get<ExpiringItem[]>(url);
  },
};
