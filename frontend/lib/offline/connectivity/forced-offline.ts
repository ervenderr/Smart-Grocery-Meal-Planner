/**
 * E2E-only forced-offline switch. Honored only when NEXT_PUBLIC_E2E === '1'
 * (native E2E builds). Release builds never set it, so the key is dead code.
 */
export const FORCE_OFFLINE_KEY: string | null = process.env.NEXT_PUBLIC_E2E_FORCE_OFFLINE_KEY || null;

/** The storage key is injected only by E2E builds (frontend-build.sh --e2e), so release bundles never contain it. */
const defaultKey = (): string | null => FORCE_OFFLINE_KEY;

type ReadStorage = Pick<Storage, 'getItem'>;
type WriteStorage = Pick<Storage, 'setItem' | 'removeItem'>;

function defaultStorage(): Storage | undefined {
  return typeof window === 'undefined' ? undefined : window.localStorage;
}

export function isForcedOffline(
  storage: ReadStorage | undefined = defaultStorage(),
  e2eFlag: string | undefined = process.env.NEXT_PUBLIC_E2E,
  key: string | null = defaultKey()
): boolean {
  if (e2eFlag !== '1' || !storage || !key) return false;
  try {
    return storage.getItem(key) === '1';
  } catch {
    return false;
  }
}

export function setForcedOffline(
  on: boolean,
  storage: WriteStorage | undefined = defaultStorage(),
  e2eFlag: string | undefined = process.env.NEXT_PUBLIC_E2E,
  key: string | null = defaultKey()
): void {
  if (e2eFlag !== '1' || !storage || !key) return;
  try {
    if (on) storage.setItem(key, '1');
    else storage.removeItem(key);
  } catch {
    // storage unavailable: nothing to force
  }
}
