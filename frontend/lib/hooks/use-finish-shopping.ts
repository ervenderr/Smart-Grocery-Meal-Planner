'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { shoppingApi } from '@/lib/api/shopping';
import { getApiErrorMessage } from '@/lib/api/errors';
import { queryKeys } from '@/lib/react-query';
import { SHOPPING_MUTATION_SCOPE } from '@/lib/hooks/use-shopping-list';
import { localIsoDate } from '@/lib/shopping/trip';
import type { CarryOverMode } from '@/types/shopping.types';

export const HISTORY_PAGE_SIZE = 10;

export interface FinishShoppingVariables {
  carryOver: CarryOverMode;
  addToPantry: boolean;
}

export function useFinishShopping() {
  const queryClient = useQueryClient();
  return useMutation({
    // Same scope as the item writes: Finish is sent only after every earlier
    // check-off/price edit has reached the server, so the saved total matches the sheet.
    scope: SHOPPING_MUTATION_SCOPE,
    mutationFn: ({ carryOver, addToPantry }: FinishShoppingVariables) =>
      shoppingApi.finish({ carryOver, receiptDate: localIsoDate(new Date()), addToPantry }),
    onSuccess: async (result) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.shopping.active() });
      queryClient.setQueryData(queryKeys.shopping.active(), result.list);
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.shopping.all, 'history'] });
      if (result.pantry && !result.pantry.failed) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.pantry.all });
      }
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Couldn't finish this trip. Try again.")),
  });
}

export function useShoppingHistory(page: number, enabled = true) {
  return useQuery({
    queryKey: queryKeys.shopping.history(page),
    queryFn: () => shoppingApi.getHistory({ page, limit: HISTORY_PAGE_SIZE }),
    placeholderData: keepPreviousData,
    enabled,
  });
}
