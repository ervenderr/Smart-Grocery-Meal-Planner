import { apiClient } from './client';
import { API_ROUTES } from '@/lib/constants/api-routes';
import type { UserPreferences, UpdatePreferencesData } from '@/types/preferences.types';

const ONBOARDING_COMPLETE_PATH = '/api/v1/users/onboarding/complete';

/**
 * User preferences API service
 */
export const preferencesApi = {
  get: (): Promise<UserPreferences> =>
    apiClient.get<UserPreferences>(API_ROUTES.USER.PREFERENCES),

  update: (data: UpdatePreferencesData): Promise<UserPreferences> =>
    apiClient.patch<UserPreferences>(API_ROUTES.USER.PREFERENCES, data),

  completeOnboarding: (): Promise<UserPreferences> =>
    apiClient.post<UserPreferences>(ONBOARDING_COMPLETE_PATH),
};
