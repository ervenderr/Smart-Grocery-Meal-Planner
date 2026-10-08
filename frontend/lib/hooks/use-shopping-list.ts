'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { shoppingApi } from '@/lib/api/shopping';
import { getApiErrorMessage } from '@/lib/api/errors';
import { queryKeys } from '@/lib/react-query';
import { applyItemPatch, removeItem, upsertItem } from '@/lib/shopping/list-cache';
import type {
  CreateShoppingItemInput,
  ShoppingItem,
  ShoppingList,
  UpdateShoppingItemInput,
} from '@/types/shopping.types';

export const SHOPPING_ITEM_MUTATION_KEY = ['shopping', 'item'] as const;

const THIRTY_SECONDS_MS = 30_000;

interface OptimisticContext {
  previous: ShoppingList | undefined;
}

export function useShoppingList() {
  return useQuery({
    queryKey: queryKeys.shopping.active(),
    queryFn: shoppingApi.getActiveList,
    staleTime: THIRTY_SECONDS_MS,
    // Per-query override so a second device stays fresh.
    refetchOnWindowFocus: true,
  });
}

/** Shared invalidate-on-last-settle so overlapping optimistic writes do not clobber each other. */
function useSettleInvalidation() {
  const queryClient = useQueryClient();
  return () => {
    if (queryClient.isMutating({ mutationKey: SHOPPING_ITEM_MUTATION_KEY }) === 1) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.shopping.active() });
    }
  };
}

export function useUpdateShoppingItem() {
  const queryClient = useQueryClient();
  const settle = useSettleInvalidation();
  const key = queryKeys.shopping.active();

  return useMutation<
    ShoppingItem,
    unknown,
    { itemId: string; patch: UpdateShoppingItemInput },
    OptimisticContext
  >({
    mutationKey: SHOPPING_ITEM_MUTATION_KEY,
    mutationFn: ({ itemId, patch }) => shoppingApi.updateItem(itemId, patch),
    onMutate: async ({ itemId, patch }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ShoppingList>(key);
      queryClient.setQueryData<ShoppingList | undefined>(key, (list) =>
        applyItemPatch(list, itemId, patch)
      );
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (context) queryClient.setQueryData(key, context.previous);
      toast.error(getApiErrorMessage(error, "Couldn't save that change. Try again."));
    },
    onSettled: settle,
  });
}

export function useDeleteShoppingItem() {
  const queryClient = useQueryClient();
  const settle = useSettleInvalidation();
  const key = queryKeys.shopping.active();

  return useMutation<ShoppingItem, unknown, { itemId: string }, OptimisticContext>({
    mutationKey: SHOPPING_ITEM_MUTATION_KEY,
    mutationFn: ({ itemId }) => shoppingApi.deleteItem(itemId),
    onMutate: async ({ itemId }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ShoppingList>(key);
      queryClient.setQueryData<ShoppingList | undefined>(
        key,
        (list) => removeItem(list, itemId).list
      );
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (context) queryClient.setQueryData(key, context.previous);
      toast.error(getApiErrorMessage(error, "Couldn't remove that item. Try again."));
    },
    onSettled: settle,
  });
}

export function useAddShoppingItem() {
  const queryClient = useQueryClient();
  const key = queryKeys.shopping.active();

  return useMutation<ShoppingItem, unknown, CreateShoppingItemInput>({
    mutationFn: (input) => shoppingApi.addItem(input),
    onSuccess: (item) => {
      queryClient.setQueryData<ShoppingList | undefined>(key, (list) => upsertItem(list, item));
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Couldn't add that item. Try again."));
    },
  });
}
