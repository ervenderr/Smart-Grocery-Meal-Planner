import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { API_BASE_URL, API_ROUTES } from '@/lib/constants/api-routes';
import { isAiConsentRequiredError } from '@/lib/ai/consent-flow';
import { useAiConsentStore } from '@/lib/ai/consent-store';
import { getAccessToken, setTokens, getRefreshToken } from '@/lib/api/token-storage';
import { expireSession } from '@/lib/api/session-expiry';
import { createAuthErrorHandler, createRefreshCoordinator } from '@/lib/api/session-refresh';

/**
 * API Client Configuration
 */
class ApiClient {
  private client: AxiosInstance;
  private handleUnauthorized: (error: AxiosError) => Promise<unknown>;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Refresh uses a BARE axios call (never this.client) to avoid interceptor recursion.
    const coordinator = createRefreshCoordinator({
      readRefreshToken: getRefreshToken,
      refreshRequest: async (refreshToken) => {
        const response = await axios.post(
          `${API_BASE_URL}${API_ROUTES.AUTH.REFRESH}`,
          { refreshToken },
          { timeout: 15000 }
        );
        return response.data?.data ?? response.data;
      },
      writeTokens: setTokens,
    });
    this.handleUnauthorized = createAuthErrorHandler({
      coordinator,
      retry: (config) => this.client.request(config),
      onSessionExpired: expireSession,
    });

    this.setupInterceptors();
  }

  /**
   * Setup request and response interceptors
   */
  private setupInterceptors() {
    // Request interceptor - Add auth token
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const token = getAccessToken();
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error: AxiosError) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor - Handle errors
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        return response;
      },
      async (error: AxiosError) => {
        if (error.response) {
          // Handle specific error codes
          switch (error.response.status) {
            case 401:
              // Try a single-flight silent refresh first. Only a definitive 401/403 from
              // /auth/refresh clears the session; transient failures (offline, timeout,
              // 5xx) must keep local state so unsynced offline work is not lost (SYNC-07).
              return this.handleUnauthorized(error);
            case 403:
              // Forbidden
              if (isAiConsentRequiredError(error)) {
                if (typeof window !== 'undefined') {
                  useAiConsentStore.getState().request();
                }
              } else {
                console.error('Access forbidden');
              }
              break;
            case 404:
              // Not found
              console.error('Resource not found');
              break;
            case 500:
              // Server error
              console.error('Server error');
              break;
          }
        } else if (error.request) {
          // Request made but no response
          console.error('No response from server');
        } else {
          // Error in request configuration
          console.error('Request configuration error');
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * GET request
   */
  async get<T = any>(url: string, config?: any): Promise<T> {
    const response = await this.client.get<T>(url, config);
    return response.data;
  }

  /**
   * POST request
   */
  async post<T = any>(url: string, data?: any, config?: any): Promise<T> {
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  /**
   * PUT request
   */
  async put<T = any>(url: string, data?: any, config?: any): Promise<T> {
    const response = await this.client.put<T>(url, data, config);
    return response.data;
  }

  /**
   * PATCH request
   */
  async patch<T = any>(url: string, data?: any, config?: any): Promise<T> {
    const response = await this.client.patch<T>(url, data, config);
    return response.data;
  }

  /**
   * DELETE request
   */
  async delete<T = any>(url: string, config?: any): Promise<T> {
    const response = await this.client.delete<T>(url, config);
    return response.data;
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
