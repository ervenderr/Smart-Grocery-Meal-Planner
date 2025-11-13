import { QueryClient } from '@tanstack/react-query';

/**
 * React Query Configuration
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnMount: true,
    },
    mutations: {
      retry: 0,
    },
  },
});

/**
 * Query Keys
 * Centralized query key factory
 */
export const queryKeys = {
  auth: {
    profile: ['auth', 'profile'] as const,
  },
  pantry: {
    all: ['pantry'] as const,
    list: (filters?: any) => ['pantry', 'list', filters] as const,
    detail: (id: string) => ['pantry', 'detail', id] as const,
    expiring: () => ['pantry', 'expiring'] as const,
  },
  recipes: {
    all: ['recipes'] as const,
    list: (filters?: any) => ['recipes', 'list', filters] as const,
    detail: (id: string) => ['recipes', 'detail', id] as const,
    favorites: () => ['recipes', 'favorites'] as const,
  },
  mealPlans: {
    all: ['mealPlans'] as const,
    list: () => ['mealPlans', 'list'] as const,
    detail: (id: string) => ['mealPlans', 'detail', id] as const,
  },
  shopping: {
    all: ['shopping'] as const,
    lists: () => ['shopping', 'lists'] as const,
    detail: (id: string) => ['shopping', 'detail', id] as const,
  },
  budget: {
    summary: () => ['budget', 'summary'] as const,
    history: (weeks?: number) => ['budget', 'history', weeks] as const,
  },
  market: {
    latest: () => ['market', 'latest'] as const,
  },
  alerts: {
    all: ['alerts'] as const,
    list: () => ['alerts', 'list'] as const,
  },
  analytics: {
    dashboard: () => ['analytics', 'dashboard'] as const,
    trends: (weeks?: number) => ['analytics', 'trends', weeks] as const,
  },
} as const;
