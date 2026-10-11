/**
 * Token store with synchronous reads from an in-memory snapshot and
 * write-through to an async secure backend (iOS Keychain on native).
 * Pure: no browser storage access. Never logs token values.
 */
export interface SecureBackend {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface TokenSnapshot {
  readonly access: string | null;
  readonly refresh: string | null;
}

export interface InitResult {
  readonly snapshot: TokenSnapshot;
  readonly readFailed: boolean;
}

export interface TokenStore {
  init(): Promise<InitResult>;
  isReady(): boolean;
  getAccess(): string | null;
  getRefresh(): string | null;
  set(tokens: { token: string; refreshToken?: string }): Promise<void>;
  clear(): Promise<void>;
  flush(): Promise<void>;
}

export const SECURE_ACCESS_KEY = 'access';
export const SECURE_REFRESH_KEY = 'refresh';

const EMPTY: TokenSnapshot = Object.freeze({ access: null, refresh: null });

function freeze(access: string | null, refresh: string | null): TokenSnapshot {
  return Object.freeze({ access, refresh });
}

function logFailure(action: string, error: unknown): void {
  console.error(`Token storage ${action} failed:`, error instanceof Error ? error.message : 'unknown');
}

export function createTokenStore(backend: SecureBackend): TokenStore {
  let snapshot: TokenSnapshot = EMPTY;
  let ready = false;
  let initPromise: Promise<InitResult> | null = null;
  let pending: Promise<void> = Promise.resolve();

  const enqueue = (action: string, task: () => Promise<void>): Promise<void> => {
    pending = pending.then(async () => {
      try {
        await task();
      } catch (error) {
        logFailure(action, error);
      }
    });
    return pending;
  };

  const load = async (): Promise<InitResult> => {
    try {
      const [access, refresh] = await Promise.all([
        backend.get(SECURE_ACCESS_KEY),
        backend.get(SECURE_REFRESH_KEY),
      ]);
      // Writes made before init finished win over the stored values.
      if (snapshot === EMPTY) snapshot = freeze(access, refresh);
      ready = true;
      return { snapshot, readFailed: false };
    } catch (error) {
      logFailure('read', error);
      ready = true;
      // A failed read (e.g. device locked) must not be memoized: allow a retry.
      initPromise = null;
      return { snapshot, readFailed: true };
    }
  };

  return {
    init: () => (initPromise ??= load()),
    isReady: () => ready,
    getAccess: () => snapshot.access,
    getRefresh: () => snapshot.refresh,
    set(tokens) {
      const refresh = tokens.refreshToken ? tokens.refreshToken : snapshot.refresh;
      snapshot = freeze(tokens.token, refresh);
      return enqueue('write', async () => {
        await backend.set(SECURE_ACCESS_KEY, tokens.token);
        if (tokens.refreshToken) await backend.set(SECURE_REFRESH_KEY, tokens.refreshToken);
      });
    },
    clear() {
      snapshot = freeze(null, null);
      return enqueue('clear', async () => {
        const results = await Promise.allSettled([
          backend.remove(SECURE_ACCESS_KEY),
          backend.remove(SECURE_REFRESH_KEY),
        ]);
        for (const r of results) if (r.status === 'rejected') logFailure('clear', r.reason);
      });
    },
    flush: () => pending,
  };
}
