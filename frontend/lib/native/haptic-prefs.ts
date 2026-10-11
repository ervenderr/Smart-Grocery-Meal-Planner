import { safeGetItem, safeSetItem, type StorageLike } from '../pwa/storage';

export const HAPTICS_ENABLED_KEY = 'kitcha:haptics-enabled';

/** Haptics default to on; only an explicit 'false' disables them. */
export function readHapticsEnabled(storage: StorageLike | undefined): boolean {
  return safeGetItem(storage, HAPTICS_ENABLED_KEY) !== 'false';
}

export function writeHapticsEnabled(storage: StorageLike | undefined, enabled: boolean): boolean {
  return safeSetItem(storage, HAPTICS_ENABLED_KEY, enabled ? 'true' : 'false');
}
