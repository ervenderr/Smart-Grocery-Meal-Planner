/**
 * E2E-only forced-offline switch. Honored only when NEXT_PUBLIC_E2E === '1'
 * (native E2E builds). Release builds never set it, so the key is dead code.
 */
export const FORCE_OFFLINE_KEY: string | null =
  process.env.NEXT_PUBLIC_E2E === '1' ? 'kitcha:e2e-force-offline' : null;

const E2E_KEY = 'kitcha:e2e-force-offline';

type ReadStorage = Pick<Storage, 'getItem'>;
type WriteStorage = Pick<Storage, 'setItem' | 'removeItem'>;

function defaultStorage(): Storage | undefined {
  return typeof window === 'undefined' ? undefined : window.localStorage;
}

export function isForcedOffline(
  storage: ReadStorage | undefined = defaultStorage(),
  e2eFlag: string | undefined = process.env.NEXT_PUBLIC_E2E
): boolean {
  if (e2eFlag !== '1' || !storage) return false;
  try {
    return storage.getItem(E2E_KEY) === '1';
  } catch {
    return false;
  }
}

export function setForcedOffline(
  on: boolean,
  storage: WriteStorage | undefined = defaultStorage(),
  e2eFlag: string | undefined = process.env.NEXT_PUBLIC_E2E
): void {
  if (e2eFlag !== '1' || !storage) return;
  try {
    if (on) storage.setItem(E2E_KEY, '1');
    else storage.removeItem(E2E_KEY);
  } catch {
    // storage unavailable: nothing to force
  }
}
