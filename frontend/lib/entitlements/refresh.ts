import { queryClient, queryKeys } from '@/lib/react-query';
import { ENTITLEMENT_QUERY_KEY } from '@/lib/api/entitlements';

/** Re-reads /entitlements/me and the pantry after the server changed the unlock. */
export function refreshEntitlementQueries(): void {
  void queryClient.invalidateQueries({ queryKey: ENTITLEMENT_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: queryKeys.pantry.all });
}
