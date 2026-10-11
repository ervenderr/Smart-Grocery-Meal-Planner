import { apiClient } from './client';
import { API_ROUTES } from '@/lib/constants/api-routes';

export const syncApi = {
  /** Raw bootstrap page; validated by the bootstrap client. */
  bootstrap: async (cursor: string | null, limit = 200): Promise<unknown> => {
    const params = cursor ? { cursor, limit } : { limit };
    return apiClient.get<unknown>(API_ROUTES.SYNC.BOOTSTRAP, { params });
  },
};
