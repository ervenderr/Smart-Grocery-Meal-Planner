/**
 * Token storage facade for the access and refresh tokens.
 *
 * Web: browser localStorage (unchanged behavior).
 * Native (Capacitor): iOS Keychain through the in-memory token store, which
 * keeps this module's synchronous read API. Native never touches localStorage
 * for tokens. Call whenTokenStorageReady() before deciding on auth state.
 * All functions are no-ops on the server and never throw on storage errors.
 */
import { isNative } from '@/lib/platform/native';
import { createTokenStore, type TokenStore } from '@/lib/auth/token-store';
import { createKeychainBackend } from '@/lib/auth/keychain-backend';
import { runNativeBoot } from '@/lib/auth/native-boot';

export const ACCESS_TOKEN_KEY = 'auth-token';
export const REFRESH_TOKEN_KEY = 'refresh-token';
export const SIGNED_OUT_COPY = "You've been signed out. Sign in again to continue.";

let nativeStore: TokenStore | null = null;
let readyPromise: Promise<{ readFailed: boolean }> | null = null;

function getNativeStore(): TokenStore {
  nativeStore ??= createTokenStore(createKeychainBackend());
  return nativeStore;
}

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
  if (isNative()) return getNativeStore().getAccess();
  return read(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (isNative()) return getNativeStore().getRefresh();
  return read(REFRESH_TOKEN_KEY);
}

export function setTokens(tokens: { token: string; refreshToken?: string }): void {
  if (isNative()) {
    void getNativeStore().set(tokens);
    return;
  }
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
  if (isNative()) {
    void getNativeStore().clear();
    return;
  }
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch (error) {
    console.error('Token storage clear failed:', error instanceof Error ? error.message : 'unknown');
  }
}

function safeLocalStorage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

async function hydrateNative(): Promise<{ readFailed: boolean }> {
  const store = getNativeStore();
  await runNativeBoot({
    storage: safeLocalStorage(),
    backend: createKeychainBackend(),
  });
  const { readFailed } = await store.init();
  // Dynamic import (not a static one) avoids the cycle with auth-store.ts,
  // which imports this module.
  const { useAuthStore } = await import('@/lib/stores/auth-store');
  useAuthStore.getState().syncFromTokenStore(readFailed ? null : store.getAccess());
  return { readFailed };
}

/** Memoized. Web resolves immediately; native resolves once Keychain tokens are loaded. */
export function whenTokenStorageReady(): Promise<{ readFailed: boolean }> {
  if (!isNative()) return Promise.resolve({ readFailed: false });
  readyPromise ??= hydrateNative().catch((error) => {
    console.error('Token storage init failed:', error instanceof Error ? error.message : 'unknown');
    return { readFailed: true };
  });
  return readyPromise;
}

/** Resolves once pending native Keychain writes have settled. */
export function flushTokenWrites(): Promise<void> {
  if (!isNative()) return Promise.resolve();
  return getNativeStore().flush();
}
