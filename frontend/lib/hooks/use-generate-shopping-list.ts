'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { shoppingApi } from '@/lib/api/shopping';
import { getApiErrorMessage } from '@/lib/api/errors';
import { queryKeys } from '@/lib/react-query';
import { SHOPPING_MUTATION_SCOPE } from '@/lib/hooks/use-shopping-list';
import { describeGenerateResult } from '@/lib/shopping/generate-summary';

export function useGenerateShoppingList() {
  const queryClient = useQueryClient();
  return useMutation({
    scope: SHOPPING_MUTATION_SCOPE,
    mutationFn: (mealPlanId: string) => shoppingApi.generateFromMealPlan(mealPlanId),
    onSuccess: async (result) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.shopping.active() });
      queryClient.setQueryData(queryKeys.shopping.active(), result.list);
      toast.success(describeGenerateResult(result));
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Couldn't add this meal plan to your list. Try again.")),
  });
}
