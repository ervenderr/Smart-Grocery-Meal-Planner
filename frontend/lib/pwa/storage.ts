export const HINT_DISMISSED_KEY = 'kitcha:ios-install-hint-dismissed';

export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export function safeGetItem(storage: StorageLike | undefined, key: string): string | null {
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSetItem(storage: StorageLike | undefined, key: string, value: string): boolean {
  if (!storage) return false;
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
