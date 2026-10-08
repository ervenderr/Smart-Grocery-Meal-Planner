/**
 * Per-user client state that must never outlive a session.
 * Keep this list in sync with any new sessionStorage/localStorage user data.
 */
export const USER_SCOPED_STORAGE_KEYS = ['current-shopping-list'] as const;

export interface ClearableCache {
  clear: () => void;
}

export interface RemovableStorage {
  removeItem: (key: string) => void;
}

/**
 * Drops all cached server data and per-user browser storage so the next
 * account in the same tab never inherits the previous user's state.
 * Storage failures (Safari private mode) are tolerated.
 */
export function clearUserSessionState(
  cache: ClearableCache,
  sessionStore?: RemovableStorage,
  localStore?: RemovableStorage
): void {
  cache.clear();
  for (const store of [sessionStore, localStore]) {
    if (!store) continue;
    for (const key of USER_SCOPED_STORAGE_KEYS) {
      try {
        store.removeItem(key);
      } catch (error) {
        console.error('Failed to clear stored session state:', error);
      }
    }
  }
}
