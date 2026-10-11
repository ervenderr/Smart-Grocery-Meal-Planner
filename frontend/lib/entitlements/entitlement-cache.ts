import type { EntitlementMe } from '@/lib/api/entitlements';

const PREFIX = 'kitcha:entitlement:';
const STATUSES = ['active', 'revoked', 'none'] as const;

export const entitlementCacheKey = (userId: string): string => `${PREFIX}${userId}`;

function isValid(value: unknown): value is EntitlementMe {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  const limits = v.limits as Record<string, unknown> | null | undefined;
  return (
    STATUSES.includes(v.status as (typeof STATUSES)[number]) &&
    typeof v.productId === 'string' &&
    typeof limits === 'object' &&
    limits !== null
  );
}

/** Display-only last-known entitlement. Never used to unlock anything; the server is authoritative. */
export function readCachedEntitlement(
  userId: string | null | undefined,
  storage: Pick<Storage, 'getItem'> | undefined
): EntitlementMe | undefined {
  if (!userId || !storage) return undefined;
  try {
    const raw = storage.getItem(entitlementCacheKey(userId));
    if (!raw) return undefined;
    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function writeCachedEntitlement(
  userId: string | null | undefined,
  me: EntitlementMe,
  storage: Pick<Storage, 'setItem'> | undefined
): void {
  if (!userId || !storage) return;
  try {
    storage.setItem(entitlementCacheKey(userId), JSON.stringify(me));
  } catch {
    // storage full or blocked; the cache is optional
  }
}

export function browserStorage(): Storage | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
