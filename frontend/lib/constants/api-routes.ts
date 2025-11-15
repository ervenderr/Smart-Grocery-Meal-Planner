/**
 * API Route Constants
 * Centralized API endpoints for the application
 */

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
export const API_VERSION = 'v1';

export const API_ROUTES = {
  // Auth
  AUTH: {
    SIGNUP: `/api/${API_VERSION}/auth/signup`,
    LOGIN: `/api/${API_VERSION}/auth/login`,
    LOGOUT: `/api/${API_VERSION}/auth/logout`,
  },

  // User
  USER: {
    PROFILE: `/api/${API_VERSION}/users/profile`,
    PREFERENCES: `/api/${API_VERSION}/users/preferences`,
  },

  // Pantry
  PANTRY: {
    BASE: `/api/${API_VERSION}/pantry`,
    BY_ID: (id: string) => `/api/${API_VERSION}/pantry/${id}`,
    EXPIRING_SOON: `/api/${API_VERSION}/pantry/expiring-soon`,
  },

  // Recipes
  RECIPES: {
    BASE: `/api/${API_VERSION}/recipes`,
    BY_ID: (id: string) => `/api/${API_VERSION}/recipes/${id}`,
    FAVORITE: (id: string) => `/api/${API_VERSION}/recipes/${id}/favorite`,
  },

  // Meal Plans
  MEAL_PLANS: {
    BASE: `/api/${API_VERSION}/mealplans`,
    BY_ID: (id: string) => `/api/${API_VERSION}/mealplans/${id}`,
    SHOPPING_LIST: (id: string) => `/api/${API_VERSION}/mealplans/${id}/shopping-list`,
  },

  // Shopping
  SHOPPING: {
    LISTS: `/api/${API_VERSION}/shopping-lists`,
    BY_ID: (id: string) => `/api/${API_VERSION}/shopping-lists/${id}`,
    ITEM: (listId: string, itemId: string) => `/api/${API_VERSION}/shopping-lists/${listId}/items/${itemId}`,
    COMPLETE: (id: string) => `/api/${API_VERSION}/shopping-lists/${id}/complete`,
  },

  // Budget & Pricing
  BUDGET: {
    SUMMARY: `/api/${API_VERSION}/budget/summary`,
    HISTORY: `/api/${API_VERSION}/budget/history`,
  },

  MARKET: {
    LATEST: `/api/${API_VERSION}/prices/latest`,
  },

  // Alerts
  ALERTS: {
    BASE: `/api/${API_VERSION}/alerts`,
    BY_ID: (id: string) => `/api/${API_VERSION}/alerts/${id}`,
    READ: (id: string) => `/api/${API_VERSION}/alerts/${id}/read`,
    SET_THRESHOLD: `/api/${API_VERSION}/alerts/set-threshold`,
  },

  // Analytics
  ANALYTICS: {
    DASHBOARD: `/api/${API_VERSION}/analytics/dashboard`,
    TRENDS: `/api/${API_VERSION}/analytics/spending-trends`,
  },

  // Notifications
  NOTIFICATIONS: {
    BASE: `/api/${API_VERSION}/notifications`,
    BY_ID: (id: string) => `/api/${API_VERSION}/notifications/${id}`,
    MARK_READ: (id: string) => `/api/${API_VERSION}/notifications/${id}/read`,
    DISMISS: (id: string) => `/api/${API_VERSION}/notifications/${id}/dismiss`,
    READ_ALL: `/api/${API_VERSION}/notifications/read-all`,
    STATS: `/api/${API_VERSION}/notifications/stats`,
    GENERATE: `/api/${API_VERSION}/notifications/generate`,
  },
} as const;
