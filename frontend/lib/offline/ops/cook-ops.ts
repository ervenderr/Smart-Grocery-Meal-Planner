import type { NewOp } from '../outbox/op-types';

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
