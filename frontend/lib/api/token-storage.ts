/**
 * Browser token storage for the access and refresh tokens.
 * All functions are no-ops on the server and never throw on storage errors.
 * Native Keychain storage replaces this in Phase 10.
 */
export const ACCESS_TOKEN_KEY = 'auth-token';
export const REFRESH_TOKEN_KEY = 'refresh-token';

function read(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    console.error('Token storage read failed:', error instanceof Error ? error.message : 'unknown');
    return null;
  }
}

export function getAccessToken(): string | null {
  return read(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return read(REFRESH_TOKEN_KEY);
}

export function setTokens(tokens: { token: string; refreshToken?: string }): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, tokens.token);
    if (tokens.refreshToken) {
      window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
    }
  } catch (error) {
    console.error('Token storage write failed:', error instanceof Error ? error.message : 'unknown');
  }
}

export function clearTokens(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch (error) {
    console.error('Token storage clear failed:', error instanceof Error ? error.message : 'unknown');
  }
}
