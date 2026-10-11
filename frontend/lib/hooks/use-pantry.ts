'use client';

import { createElement, useCallback, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { pantryApi } from '@/lib/api/pantry';
import { fetchAllPantryItems } from '@/lib/pantry/fetch-all-pantry';
import { filterPantryItems } from '@/lib/pantry/filter-list';
import { normalizePantryItem } from '@/lib/pantry/normalize';
import { PANTRY_ALL_KEY } from '@/lib/offline/cache/cache-keys';
import { queryKeys } from '@/lib/react-query';
import { offlineWrite, offlineWriteMany } from '@/lib/offline/facade';
import { withPendingOps } from '@/lib/offline/reconcile/fold-query';
import { buildPantryDelete, buildPantryQuickPatchOps } from '@/lib/offline/ops/pantry-ops';
import type { PantryItem } from '@/types/pantry.types';

export type PantryQuickPatch = { quantity?: number; expiryDate?: string | null };

type PantryFilters = { category?: string; search?: string };

const LIST_KEY = [...queryKeys.pantry.all, 'list'] as const;
const UNDO_WINDOW_MS = 5000;

/** Ids hidden while their delete is deferred; survives refetches until the timer settles. */
const pendingRemovalIds = new Set<string>();

export function usePantryList(filters: PantryFilters) {
  const { category, search } = filters;
  return useQuery({
    queryKey: PANTRY_ALL_KEY,
    // Pending outbox ops are folded over every refetch so the optimistic overlay survives.
    queryFn: withPendingOps<PantryItem[]>(PANTRY_ALL_KEY, async () => {
      const items = await fetchAllPantryItems((page, limit) => pantryApi.getAll({ page, limit }));
      return items.map(normalizePantryItem);
    }),
    select: (items) =>
      filterPantryItems(
        items.filter((item) => !pendingRemovalIds.has(item.id)),
        { category, search },
      ),
  });
}

type ListSnapshot = ReadonlyArray<readonly [readonly unknown[], PantryItem[] | undefined]>;

const applyPatch = (item: PantryItem, patch: PantryQuickPatch): PantryItem => ({
  ...item,
  ...(patch.quantity !== undefined ? { quantity: patch.quantity } : {}),
  ...(patch.expiryDate !== undefined ? { expiryDate: patch.expiryDate } : {}),
});

/** Item as displayed before the optimistic patch (base for delta/inverse), keyed by mutation variables. */
const currentItems = new WeakMap<object, PantryItem | undefined>();
const queuedWrites = new WeakSet<object>();

export function usePantryPatch() {
  const queryClient = useQueryClient();

  return useMutation<
    PantryItem | null,
    unknown,
    { id: string; patch: PantryQuickPatch },
    { snapshot: ListSnapshot }
  >({
    mutationFn: async (vars) => {
      const outcome = await offlineWriteMany({
        ops: () => {
          const current = currentItems.get(vars);
          if (!current) throw new Error('Cannot queue a pantry change for an item that is not loaded');
          return buildPantryQuickPatchOps(current, vars.patch);
        },
        direct: () => pantryApi.update(vars.id, vars.patch),
      });
      if (outcome.mode === 'queued') {
        queuedWrites.add(vars);
        return null;
      }
      return outcome.result;
    },
    onMutate: async (vars) => {
      const { id, patch } = vars;
      await queryClient.cancelQueries({ queryKey: queryKeys.pantry.all });
      const snapshot = queryClient.getQueriesData<PantryItem[]>({ queryKey: LIST_KEY });
      currentItems.set(
        vars,
        snapshot.flatMap(([, items]) => items ?? []).find((item) => item.id === id)
      );
      queryClient.setQueriesData<PantryItem[]>({ queryKey: LIST_KEY }, (items) =>
        items?.map((item) => (item.id === id ? applyPatch(item, patch) : item))
      );
      return { snapshot };
    },
    onError: (_error, _vars, context) => {
      context?.snapshot.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    onSettled: (_data, _error, vars) => {
      // Queued writes are reconciled by the drain; a refetch now would overwrite optimistic state.
      if (queuedWrites.has(vars)) return;
      void queryClient.invalidateQueries({ queryKey: queryKeys.pantry.all });
    },
  });
}

interface PendingRemoval {
  readonly item: PantryItem;
  readonly timer: ReturnType<typeof setTimeout>;
  readonly toastId: string;
}

export function useDeferredRemove() {
  const queryClient = useQueryClient();
  const pending = useRef(new Map<string, PendingRemoval>());

  const commit = useCallback(
    async (item: PantryItem) => {
      const entry = pending.current.get(item.id);
      if (!entry) return;
      clearTimeout(entry.timer);
      pending.current.delete(item.id);
      toast.dismiss(entry.toastId);
      let queued = false;
      try {
        const outcome = await offlineWrite({
          op: () => buildPantryDelete(item),
          direct: () => pantryApi.delete(item.id),
        });
        queued = outcome.mode === 'queued';
      } catch {
        toast.error(`Couldn't remove ${item.ingredientName}. Try again.`);
      } finally {
        pendingRemovalIds.delete(item.id);
        if (!queued) void queryClient.invalidateQueries({ queryKey: queryKeys.pantry.all });
      }
    },
    [queryClient]
  );

  const undo = useCallback(
    (item: PantryItem) => {
      const entry = pending.current.get(item.id);
      if (!entry) return;
      clearTimeout(entry.timer);
      pending.current.delete(item.id);
      toast.dismiss(entry.toastId);
      pendingRemovalIds.delete(item.id);
      void queryClient.invalidateQueries({ queryKey: queryKeys.pantry.all });
    },
    [queryClient]
  );

  const remove = useCallback(
    (item: PantryItem) => {
      if (pending.current.has(item.id)) return;
      pendingRemovalIds.add(item.id);
      queryClient.setQueriesData<PantryItem[]>({ queryKey: LIST_KEY }, (items) =>
        items?.filter((candidate) => candidate.id !== item.id)
      );

      const toastId = toast.custom(
        () =>
          createElement(
            'div',
            {
              className:
                'flex items-center gap-3 rounded-lg bg-gray-900 px-4 py-2 text-base text-white shadow-lg',
            },
            createElement('span', null, `${item.ingredientName} removed.`),
            createElement(
              'button',
              {
                type: 'button',
                onClick: () => undo(item),
                className: 'min-h-11 px-2 text-base font-semibold text-primary-200 underline',
              },
              'Undo'
            )
          ),
        { duration: UNDO_WINDOW_MS }
      );

      const timer = setTimeout(() => void commit(item), UNDO_WINDOW_MS);
      pending.current.set(item.id, { item, timer, toastId });
    },
    [queryClient, commit, undo]
  );

  useEffect(() => {
    const map = pending.current;
    return () => {
      Array.from(map.values()).forEach((entry) => void commit(entry.item));
    };
  }, [commit]);

  return { remove };
}
