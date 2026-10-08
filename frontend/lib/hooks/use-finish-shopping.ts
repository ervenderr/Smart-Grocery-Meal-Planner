'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { shoppingApi } from '@/lib/api/shopping';
import { getApiErrorMessage } from '@/lib/api/errors';
import { queryKeys } from '@/lib/react-query';
import { localIsoDate } from '@/lib/shopping/trip';
import type { CarryOverMode } from '@/types/shopping.types';

export const HISTORY_PAGE_SIZE = 10;

export function useFinishShopping() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (carryOver: CarryOverMode) =>
      shoppingApi.finish({ carryOver, receiptDate: localIsoDate(new Date()) }),
    onSuccess: (result) => {
      queryClient.setQueryData(queryKeys.shopping.active(), result.list);
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.shopping.all, 'history'] });
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
