'use client';

import { useQuery } from '@tanstack/react-query';
import { mealPlanApi } from '@/lib/api/mealplans';
import { fetchAllPages } from '@/lib/api/fetch-all-pages';
import { MEAL_PLANS_ALL_KEY } from '@/lib/offline/cache/cache-keys';
import type { MealPlan } from '@/types/mealplan.types';

type MealPlanListOptions = { sort?: 'startDate-desc' };

const byStartDateDesc = (plans: readonly MealPlan[]): MealPlan[] =>
  [...plans].sort((a, b) => (a.startDate < b.startDate ? 1 : a.startDate > b.startDate ? -1 : 0));

/** Full meal plan list on the canonical (persisted) key; sorting runs in memory. */
export function useMealPlansList(opts: MealPlanListOptions = {}) {
  const sort = opts.sort;
  return useQuery({
    queryKey: MEAL_PLANS_ALL_KEY,
    queryFn: () => fetchAllPages((page, limit) => mealPlanApi.getAll({ page, limit })),
    select: (plans) => (sort === 'startDate-desc' ? byStartDateDesc(plans) : plans),
  });
}
