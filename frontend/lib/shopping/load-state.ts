/**
 * Pure view-state for the shopping list screen.
 *
 * In TanStack Query v5 a failed background refetch sets `isError` even though
 * cached `data` is still present. The full-screen error must only appear when
 * there is nothing to show; otherwise keep the list and offer an inline retry.
 */
export type ShoppingLoadState = 'loading' | 'error' | 'refresh-failed' | 'ready';

export function getShoppingLoadState(input: {
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly hasData: boolean;
}): ShoppingLoadState {
  if (input.isLoading && !input.hasData) return 'loading';
  if (input.isError) return input.hasData ? 'refresh-failed' : 'error';
  return 'ready';
}
