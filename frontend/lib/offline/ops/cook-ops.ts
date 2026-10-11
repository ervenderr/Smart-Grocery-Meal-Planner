import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/react-query';
import type { NewOp } from '../outbox/op-types';

/**
 * After "Cooked it": refetch the pantry only when the server applied the cook directly.
 * A queued cook (null result) is reconciled by the drain; a refetch now would replace the
 * folded optimistic pantry with raw server data.
 */
export function refreshAfterCook(queryClient: Pick<QueryClient, 'invalidateQueries'>, result: unknown | null): void {
  if (result === null) return;
  void queryClient.invalidateQueries({ queryKey: queryKeys.pantry.all });
}

export interface BuildCookApplyArgs {
  target: { recipeId: string } | { mealPlanItemId: string };
  servings: number;
  title: string;
  previousCookedAt: string | null;
  now: Date;
}

/** Cooked it / meal mark. The deduction plan is resolved at drain time, not here. */
export function buildCookApply({ target, servings, title, previousCookedAt, now }: BuildCookApplyArgs): NewOp {
  return {
    kind: 'cook.apply',
    label: title,
    payload: { target, servings, occurredAt: now.toISOString() },
    inverse: { previousCookedAt },
  };
}
