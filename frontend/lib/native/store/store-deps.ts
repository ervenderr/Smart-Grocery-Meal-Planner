import { entitlementsApi } from '../../api/entitlements';
import { newId } from '../../offline/ids';
import { getStorePlugin } from './store-plugin';
import type { StoreDeps } from './store-service';

let override: StoreDeps | null = null;

/** E2E only: ignored unless the e2e flag is '1'. Replaces the reference, never mutates. */
export function setStoreDepsOverride(
  deps: StoreDeps | null,
  e2eFlag: string | undefined = process.env.NEXT_PUBLIC_E2E
): void {
  if (e2eFlag !== '1') return;
  override = deps;
}

export async function getStoreDeps(
  isOnline: () => boolean,
  e2eFlag: string | undefined = process.env.NEXT_PUBLIC_E2E
): Promise<StoreDeps | null> {
  if (override && e2eFlag === '1') return override;
  const plugin = await getStorePlugin();
  if (!plugin) return null;
  return { plugin, verify: entitlementsApi.verify, newKey: newId, isOnline };
}
