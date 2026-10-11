import type { QueryClient } from '@tanstack/react-query';
import { MEAL_PLANS_ALL_KEY } from '@/lib/offline/cache/cache-keys';
import { buildCookApply } from '@/lib/offline/ops/cook-ops';
import { foldMealPlans } from '@/lib/offline/outbox/fold';
import type { EnqueueOpts } from '@/lib/offline/outbox/store';
import type { OfflineRuntime } from '@/lib/offline/runtime';
import type { MealPlan } from '@/types/mealplan.types';
import type { CookTarget } from '@/types/cook.types';

export const COOK_QUEUED_TOAST = "Saved. Your pantry will update when you're back online.";

function previousCookedAt(plans: readonly MealPlan[] | undefined, target: CookTarget): string | null {
  if (!('mealPlanItemId' in target)) return null;
  for (const plan of plans ?? []) {
    const meal = plan.meals.find((m) => m.id === target.mealPlanItemId);
    if (meal) return meal.cookedAt ?? null;
  }
  return null;
}

export interface QueueCookArgs {
  runtime: Pick<OfflineRuntime, 'enqueue'>;
  queryClient: QueryClient;
  target: CookTarget;
  servings: number;
  title: string;
  opts?: EnqueueOpts;
  now?: Date;
}

/** Queues a cook.apply and shows the meal as cooked immediately. */
export async function queueCook({
  runtime,
  queryClient,
  target,
  servings,
  title,
  opts,
  now = new Date(),
}: QueueCookArgs): Promise<void> {
  const plans = queryClient.getQueryData<MealPlan[]>(MEAL_PLANS_ALL_KEY);
  const op = buildCookApply({ target, servings, title, previousCookedAt: previousCookedAt(plans, target), now });
  const enqueued = await runtime.enqueue(op, opts);
  if (!enqueued) return;
  await queryClient.cancelQueries({ queryKey: MEAL_PLANS_ALL_KEY });
  queryClient.setQueryData<MealPlan[] | undefined>(MEAL_PLANS_ALL_KEY, (current) =>
    current ? foldMealPlans(current, [enqueued]) : current
  );
}
