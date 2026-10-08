'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { shoppingApi } from '@/lib/api/shopping';
import { getApiErrorMessage } from '@/lib/api/errors';
import { queryKeys } from '@/lib/react-query';
import {
  applyItemPatch,
  removeItem,
  restoreItem,
  revertItemPatch,
  upsertItem,
} from '@/lib/shopping/list-cache';
import type {
  CreateShoppingItemInput,
  ShoppingItem,
  ShoppingList,
  UpdateShoppingItemInput,
} from '@/types/shopping.types';

export const SHOPPING_ITEM_MUTATION_KEY = ['shopping', 'item'] as const;

/**
 * All list-writing mutations (toggle, edit, delete, add, generate, finish) share
 * one scope so TanStack Query runs them one at a time in tap order. The
 * optimistic cache update still happens immediately; only the network call is
 * queued. This keeps server order equal to UI order and lets Finish wait for
 * every earlier check-off to land.
 */
export const SHOPPING_MUTATION_SCOPE = { id: 'shopping-list-writes' } as const;

const THIRTY_SECONDS_MS = 30_000;

interface UpdateContext {
  previousItem: ShoppingItem | undefined;
}

interface DeleteContext {
  removed: ShoppingItem | null;
  index: number;
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
    UpdateContext
  >({
    mutationKey: SHOPPING_ITEM_MUTATION_KEY,
    scope: SHOPPING_MUTATION_SCOPE,
    mutationFn: ({ itemId, patch }) => shoppingApi.updateItem(itemId, patch),
    onMutate: async ({ itemId, patch }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previousItem = queryClient
        .getQueryData<ShoppingList>(key)
        ?.items.find((item) => item.id === itemId);
      queryClient.setQueryData<ShoppingList | undefined>(key, (list) =>
        applyItemPatch(list, itemId, patch)
      );
      return { previousItem };
    },
    onError: (error, { patch }, context) => {
      // Revert only this mutation's fields, and only if no newer write changed them.
      queryClient.setQueryData<ShoppingList | undefined>(key, (list) =>
        revertItemPatch(list, context?.previousItem, patch)
      );
      toast.error(getApiErrorMessage(error, "Couldn't save that change. Try again."));
    },
    onSettled: settle,
  });
}

export function useDeleteShoppingItem() {
  const queryClient = useQueryClient();
  const settle = useSettleInvalidation();
  const key = queryKeys.shopping.active();

  return useMutation<ShoppingItem, unknown, { itemId: string }, DeleteContext>({
    mutationKey: SHOPPING_ITEM_MUTATION_KEY,
    scope: SHOPPING_MUTATION_SCOPE,
    mutationFn: ({ itemId }) => shoppingApi.deleteItem(itemId),
    onMutate: async ({ itemId }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const current = queryClient.getQueryData<ShoppingList>(key);
      const index = current?.items.findIndex((item) => item.id === itemId) ?? -1;
      const removed = current ? removeItem(current, itemId).removed : null;
      queryClient.setQueryData<ShoppingList | undefined>(
        key,
        (list) => removeItem(list, itemId).list
      );
      return { removed, index };
    },
    onError: (error, _vars, context) => {
      if (context) {
        queryClient.setQueryData<ShoppingList | undefined>(key, (list) =>
          restoreItem(list, context.removed, context.index)
        );
      }
      toast.error(getApiErrorMessage(error, "Couldn't remove that item. Try again."));
    },
    onSettled: settle,
  });
}

export function useAddShoppingItem() {
  const queryClient = useQueryClient();
  const settle = useSettleInvalidation();
  const key = queryKeys.shopping.active();

  return useMutation<ShoppingItem, unknown, CreateShoppingItemInput>({
    mutationKey: SHOPPING_ITEM_MUTATION_KEY,
    scope: SHOPPING_MUTATION_SCOPE,
    mutationFn: (input) => shoppingApi.addItem(input),
    onSuccess: (item) => {
      queryClient.setQueryData<ShoppingList | undefined>(key, (list) => upsertItem(list, item));
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Couldn't add that item. Try again."));
    },
    onSettled: settle,
  });
}
