export type PantryAddDecision = 'proceed' | 'upgrade' | 'web-limit';

export interface PantryAddInput {
  native: boolean;
  online: boolean;
  entitlementStatus: 'active' | 'revoked' | 'none' | undefined;
  pantryLimit: number | null | undefined;
  activeCount: number | undefined;
}

/**
 * Local UX pre-check for the Add Item form. Cached values are hints only: unknown
 * state proceeds and the server's 403 UPGRADE_REQUIRED stays authoritative.
 */
export function decidePantryAdd(input: PantryAddInput): PantryAddDecision {
  const { native, online, entitlementStatus, pantryLimit, activeCount } = input;
  if (!online) return 'proceed';
  if (entitlementStatus === undefined || entitlementStatus === 'active') return 'proceed';
  if (pantryLimit === null || pantryLimit === undefined) return 'proceed';
  if (activeCount === undefined || activeCount < pantryLimit) return 'proceed';
  return native ? 'upgrade' : 'web-limit';
}
