import { apiClient } from './client';
import { API_ROUTES } from '@/lib/constants/api-routes';
import type { User, LoginCredentials, SignupData, AuthResponse } from '@/types/auth.types';

/**
 * Authentication API Service
 */
export const authApi = {
  /**
   * Sign up a new user
   */
  signup: async (data: SignupData): Promise<AuthResponse> => {
    return apiClient.post<AuthResponse>(API_ROUTES.AUTH.SIGNUP, data);
  },

  /**
   * Login user
   */
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    return apiClient.post<AuthResponse>(API_ROUTES.AUTH.LOGIN, credentials);
  },

  /**
   * Logout user
   */
  logout: async (): Promise<void> => {
    return apiClient.post<void>(API_ROUTES.AUTH.LOGOUT);
  },

  /**
   * Get current user profile
   */
  getProfile: async (): Promise<User> => {
    return apiClient.get<User>(API_ROUTES.USER.PROFILE);
  },

  /**
   * Update user profile
   */
  updateProfile: async (data: Partial<User>): Promise<User> => {
    return apiClient.patch<User>(API_ROUTES.USER.PROFILE, data);
  },

  /**
   * Update user preferences
   */
  updatePreferences: async (preferences: any): Promise<any> => {
    return apiClient.patch(API_ROUTES.USER.PREFERENCES, preferences);
  },
};
