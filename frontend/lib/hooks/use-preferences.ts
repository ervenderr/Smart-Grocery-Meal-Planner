'use client';

import { useQuery } from '@tanstack/react-query';
import { preferencesApi } from '@/lib/api/preferences';
import { useAuthStore } from '@/lib/stores/auth-store';

export const PREFERENCES_QUERY_KEY = ['preferences'] as const;

const FIVE_MINUTES_MS = 5 * 60_000;

export function usePreferences() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: PREFERENCES_QUERY_KEY,
    queryFn: preferencesApi.get,
    enabled: isAuthenticated,
    staleTime: FIVE_MINUTES_MS,
  });
}
