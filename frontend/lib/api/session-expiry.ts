import { useAuthStore } from '@/lib/stores/auth-store';
import { isNative } from '@/lib/platform/native';
import { navigate } from '@/lib/platform/navigation';
import { setSessionEndIntent } from '@/lib/offline/session/session-hooks';

/**
 * Definitive session expiry (refresh token rejected). clearAuth drops tokens,
 * query cache and per-user storage AND flips isAuthenticated, so the login
 * page and ProtectedRoute agree the user is signed out (no redirect loop) and
 * the reminder runtime cancels scheduled notifications.
 */
export function expireSession(): void {
  // Expiry keeps the on-disk cache and every queued change for the next sign-in
  setSessionEndIntent('expired');
  useAuthStore.getState().clearAuth();
  if (typeof window !== 'undefined') {
    if (isNative()) navigate('/login/', { replace: true });
    else window.location.href = '/login';
  }
}
