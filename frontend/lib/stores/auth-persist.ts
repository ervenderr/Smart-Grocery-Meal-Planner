import type { User } from '@/types/auth.types';

export interface PersistedAuth {
  user: User | null;
  token?: string | null;
  isAuthenticated?: boolean;
}

/**
 * Pure zustand partialize. On native the access token lives only in Keychain,
 * so it (and the derived isAuthenticated flag) is never written to localStorage.
 */
export function selectPersisted(
  state: { user: User | null; token: string | null; isAuthenticated: boolean },
  native: boolean
): PersistedAuth {
  if (native) return { user: state.user };
  return { user: state.user, token: state.token, isAuthenticated: state.isAuthenticated };
}
