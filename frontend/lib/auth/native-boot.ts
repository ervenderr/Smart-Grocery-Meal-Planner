import { SECURE_ACCESS_KEY, SECURE_REFRESH_KEY, type SecureBackend } from './token-store';

export const INSTALL_MARKER_KEY = 'kitcha:installed';
export const LEGACY_TOKEN_KEYS = ['auth-token', 'refresh-token'] as const;
const PERSIST_KEY = 'auth-storage';

export interface BootStorage {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

function attempt<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function scrubPersistedAuth(storage: BootStorage): void {
  const raw = attempt(() => storage.getItem(PERSIST_KEY), null);
  if (raw === null) return;
  try {
    const parsed = JSON.parse(raw) as { state?: Record<string, unknown> } | null;
    if (!parsed || typeof parsed !== 'object' || !parsed.state || typeof parsed.state !== 'object') {
      throw new Error('invalid');
    }
    const { token: _token, isAuthenticated: _auth, ...rest } = parsed.state;
    void _token;
    void _auth;
    storage.setItem(PERSIST_KEY, JSON.stringify({ ...parsed, state: rest }));
  } catch {
    attempt(() => storage.removeItem(PERSIST_KEY), undefined);
  }
}

async function clearKeychain(backend: SecureBackend): Promise<void> {
  const results = await Promise.allSettled([
    backend.remove(SECURE_ACCESS_KEY),
    backend.remove(SECURE_REFRESH_KEY),
  ]);
  for (const r of results) {
    if (r.status === 'rejected') {
      console.error('Native boot keychain clear failed:', r.reason instanceof Error ? r.reason.message : 'unknown');
    }
  }
}

/**
 * Keychain survives uninstall but WebView localStorage does not, so a missing
 * install marker means a fresh (re)install: drop stale Keychain tokens.
 * Trade-off: WKWebView may evict localStorage under storage pressure while the
 * app stays installed, which looks like a fresh install and signs the user out
 * (a safe failure: re-login). A uninstall-surviving marker would need a
 * native preferences plugin.
 * Always scrubs legacy localStorage token copies. Never throws.
 */
export async function runNativeBoot(deps: {
  storage: BootStorage | undefined;
  backend: SecureBackend;
}): Promise<{ firstLaunch: boolean }> {
  const { storage, backend } = deps;
  if (!storage) return { firstLaunch: false };

  const firstLaunch = attempt(() => storage.getItem(INSTALL_MARKER_KEY), null) === null;
  if (firstLaunch) {
    // Write the marker FIRST and read it back. If it cannot be persisted, every
    // launch would look like a fresh install and wipe the Keychain, so skip the wipe.
    const markerPersisted = attempt(() => {
      const value = new Date().toISOString();
      storage.setItem(INSTALL_MARKER_KEY, value);
      return storage.getItem(INSTALL_MARKER_KEY) === value;
    }, false);
    if (markerPersisted) await clearKeychain(backend);
  }
  for (const key of LEGACY_TOKEN_KEYS) attempt(() => storage.removeItem(key), undefined);
  scrubPersistedAuth(storage);
  return { firstLaunch };
}
