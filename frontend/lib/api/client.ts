import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { API_BASE_URL } from '@/lib/constants/api-routes';

/**
 * API Client Configuration
 */
class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
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
        const token = this.getToken();
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
              // Only redirect if not on login/signup pages (token expired scenario)
              // Don't redirect on login/signup endpoints (wrong credentials)
              const url = error.config?.url || '';
              const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/signup');

              if (!isAuthEndpoint) {
                // Unauthorized - clear token and redirect to login
                this.clearToken();
                if (typeof window !== 'undefined') {
                  window.location.href = '/login';
                }
              }
              break;
            case 403:
              // Forbidden
              console.error('Access forbidden');
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
   * Get authentication token from storage
   */
  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('auth-token');
  }

  /**
   * Clear authentication token
   */
  private clearToken(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('auth-token');
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
