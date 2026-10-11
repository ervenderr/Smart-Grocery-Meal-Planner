'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { shoppingApi } from '@/lib/api/shopping';
import { getApiErrorMessage } from '@/lib/api/errors';
import { queryKeys } from '@/lib/react-query';
import { offlineWrite, type WriteOutcome } from '@/lib/offline/facade';
import { newId } from '@/lib/offline/ids';
import { getOfflineRuntime } from '@/lib/offline/runtime';
import { useAuthStore } from '@/lib/stores/auth-store';
import { isFinishPending } from '@/lib/offline/ops/finish-ops';
import {
  buildShoppingCreate,
  buildShoppingDelete,
  buildShoppingUpdate,
} from '@/lib/offline/ops/shopping-ops';
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

export const FINISH_LOCK_COPY = "Your trip is still syncing. You can edit the list once it's recorded.";

class FinishLockedError extends Error {
  constructor() {
    super(FINISH_LOCK_COPY);
    this.name = 'FinishLockedError';
  }
}

const isFinishLockedError = (e: unknown): boolean => e instanceof FinishLockedError;

/** Native only: rejects (with a toast) while a queued finish trip has not synced yet. */
async function assertListUnlocked(): Promise<void> {
  const runtime = getOfflineRuntime();
  const userId = useAuthStore.getState().user?.id;
  if (!runtime || !userId) return;
  if (isFinishPending(await runtime.store.list(userId))) {
    toast.error(FINISH_LOCK_COPY);
    throw new FinishLockedError();
  }
}

export const SHOPPING_ITEM_MUTATION_KEY = ['shopping', 'item'] as const;

/**
 * All list-writing mutations (toggle, edit, delete, add, generate, finish) share
 * one scope so TanStack Query runs them one at a time in tap order. The
 * optimistic cache update still happens immediately; only the network call is
 * queued. This keeps server order equal to UI order and lets Finish wait for
 * every earlier check-off to land.
 */
export const SHOPPING_MUTATION_SCOPE = { id: 'shopping-list-writes' } as const;

/** Item as displayed before an optimistic patch; the inverse of a queued update. */
const previousItems = new WeakMap<object, ShoppingItem | undefined>();

const THIRTY_SECONDS_MS = 30_000;

interface UpdateContext {
  previousItem: ShoppingItem | undefined;
}

interface AddContext {
  addedId: string | null;
}

/** Ids generated for queued creates, keyed by the mutation input object. */
const newIds = new WeakMap<object, string>();

function optimisticItem(listId: string, id: string, input: CreateShoppingItemInput): ShoppingItem {
  const stamp = new Date().toISOString();
  return {
    id,
    shoppingListId: listId,
    itemName: input.itemName,
    quantity: input.quantity ?? 1,
    unit: input.unit ?? '',
    category: input.category ?? 'other',
    costEstimateCents: input.costEstimateCents ?? null,
    actualCostCents: input.actualCostCents ?? null,
    isChecked: input.isChecked ?? false,
    notes: input.notes ?? null,
    createdAt: stamp,
    updatedAt: stamp,
  };
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

/** Per-call write mode, keyed by the mutation variables object (same instance in every callback). */
const modes = new WeakMap<object, WriteOutcome<unknown>['mode']>();

function record<T>(vars: object, outcome: WriteOutcome<T>): T | null {
  modes.set(vars, outcome.mode);
  return outcome.mode === 'direct' ? outcome.result : null;
}

/**
 * Shared invalidate-on-last-settle so overlapping optimistic writes do not clobber each other.
 * Queued (outbox) writes never invalidate: the drain reconciles the cache, and a refetch while
 * ops are pending would flash server state over the optimistic list.
 */
function useSettleInvalidation() {
  const queryClient = useQueryClient();
  return (_data: unknown, _error: unknown, vars: object) => {
    if (modes.get(vars) === 'queued') return;
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
    ShoppingItem | null,
    unknown,
    { itemId: string; patch: UpdateShoppingItemInput },
    UpdateContext
  >({
    mutationKey: SHOPPING_ITEM_MUTATION_KEY,
    scope: SHOPPING_MUTATION_SCOPE,
    mutationFn: async (vars) =>
      record(
        vars,
        await offlineWrite({
          op: () => buildShoppingUpdate(previousItems.get(vars), vars.itemId, vars.patch),
          direct: () => shoppingApi.updateItem(vars.itemId, vars.patch),
        })
      ),
    onMutate: async (vars) => {
      await assertListUnlocked();
      const { itemId, patch } = vars;
      await queryClient.cancelQueries({ queryKey: key });
      const previousItem = queryClient
        .getQueryData<ShoppingList>(key)
        ?.items.find((item) => item.id === itemId);
      previousItems.set(vars, previousItem);
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
      if (!isFinishLockedError(error)) toast.error(getApiErrorMessage(error, "Couldn't save that change. Try again."));
    },
    onSettled: settle,
  });
}

export function useDeleteShoppingItem() {
  const queryClient = useQueryClient();
  const settle = useSettleInvalidation();
  const key = queryKeys.shopping.active();

  return useMutation<ShoppingItem | null, unknown, { itemId: string }, DeleteContext>({
    mutationKey: SHOPPING_ITEM_MUTATION_KEY,
    scope: SHOPPING_MUTATION_SCOPE,
    mutationFn: async (vars) => {
      const item = previousItems.get(vars);
      return record(
        vars,
        await offlineWrite({
          op: () => {
            if (!item) throw new Error('Cannot queue a delete for an item that is not in the list');
            return buildShoppingDelete(item);
          },
          direct: () => shoppingApi.deleteItem(vars.itemId),
        })
      );
    },
    onMutate: async (vars) => {
      await assertListUnlocked();
      const { itemId } = vars;
      await queryClient.cancelQueries({ queryKey: key });
      const current = queryClient.getQueryData<ShoppingList>(key);
      const index = current?.items.findIndex((item) => item.id === itemId) ?? -1;
      const removed = current ? removeItem(current, itemId).removed : null;
      previousItems.set(vars, removed ?? undefined);
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
      if (!isFinishLockedError(error)) toast.error(getApiErrorMessage(error, "Couldn't remove that item. Try again."));
    },
    onSettled: settle,
  });
}

export function useAddShoppingItem() {
  const queryClient = useQueryClient();
  const settle = useSettleInvalidation();
  const key = queryKeys.shopping.active();

  return useMutation<ShoppingItem | null, unknown, CreateShoppingItemInput, AddContext>({
    mutationKey: SHOPPING_ITEM_MUTATION_KEY,
    scope: SHOPPING_MUTATION_SCOPE,
    mutationFn: async (input) =>
      record(
        input,
        await offlineWrite({
          op: () => buildShoppingCreate(input, newIds.get(input) ?? newId()),
          direct: () => shoppingApi.addItem(input),
        })
      ),
    onMutate: async (input) => {
      await assertListUnlocked();
      // Native: show the item immediately under the id the queued op will carry.
      if (!getOfflineRuntime()) return { addedId: null };
      const id = newId();
      newIds.set(input, id);
      await queryClient.cancelQueries({ queryKey: key });
      queryClient.setQueryData<ShoppingList | undefined>(key, (list) =>
        list ? upsertItem(list, optimisticItem(list.id, id, input)) : list
      );
      return { addedId: id };
    },
    onSuccess: (item) => {
      if (!item) return;
      queryClient.setQueryData<ShoppingList | undefined>(key, (list) => upsertItem(list, item));
    },
    onError: (error, _input, context) => {
      if (context?.addedId) {
        const addedId = context.addedId;
        queryClient.setQueryData<ShoppingList | undefined>(
          key,
          (list) => removeItem(list, addedId).list
        );
      }
      if (!isFinishLockedError(error)) toast.error(getApiErrorMessage(error, "Couldn't add that item. Try again."));
    },
    onSettled: settle,
  });
}
