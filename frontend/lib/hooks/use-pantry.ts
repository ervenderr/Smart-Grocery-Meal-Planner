'use client';

import { createElement, useCallback, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { pantryApi } from '@/lib/api/pantry';
import { queryKeys } from '@/lib/react-query';
import type { PantryItem } from '@/types/pantry.types';

export type PantryQuickPatch = { quantity?: number; expiryDate?: string | null };

type PantryFilters = { category?: string; search?: string };

const LIST_KEY = [...queryKeys.pantry.all, 'list'] as const;
const UNDO_WINDOW_MS = 5000;

/** Ids hidden while their delete is deferred; survives refetches until the timer settles. */
const pendingRemovalIds = new Set<string>();

/** The API returns Decimal quantities as strings; the UI works in numbers. */
const normalizeItem = (item: PantryItem): PantryItem => ({
  ...item,
  quantity: Number(item.quantity),
});

export function usePantryList(filters: PantryFilters) {
  return useQuery({
    queryKey: queryKeys.pantry.list(filters),
    queryFn: async () => {
      const response = await pantryApi.getAll({
        category: filters.category || undefined,
        search: filters.search || undefined,
      });
      return (response.items ?? []).map(normalizeItem);
    },
    select: (items) => items.filter((item) => !pendingRemovalIds.has(item.id)),
  });
}

type ListSnapshot = ReadonlyArray<readonly [readonly unknown[], PantryItem[] | undefined]>;

const applyPatch = (item: PantryItem, patch: PantryQuickPatch): PantryItem => ({
  ...item,
  ...(patch.quantity !== undefined ? { quantity: patch.quantity } : {}),
  ...(patch.expiryDate !== undefined ? { expiryDate: patch.expiryDate } : {}),
});

export function usePantryPatch() {
  const queryClient = useQueryClient();

  return useMutation<
    PantryItem,
    unknown,
    { id: string; patch: PantryQuickPatch },
    { snapshot: ListSnapshot }
  >({
    mutationFn: ({ id, patch }) => pantryApi.update(id, patch),
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.pantry.all });
      const snapshot = queryClient.getQueriesData<PantryItem[]>({ queryKey: LIST_KEY });
      queryClient.setQueriesData<PantryItem[]>({ queryKey: LIST_KEY }, (items) =>
        items?.map((item) => (item.id === id ? applyPatch(item, patch) : item))
      );
      return { snapshot };
    },
    onError: (_error, _vars, context) => {
      context?.snapshot.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    onSettled: () => {
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
      try {
        await pantryApi.delete(item.id);
      } catch {
        toast.error(`Couldn't remove ${item.ingredientName}. Try again.`);
      } finally {
        pendingRemovalIds.delete(item.id);
        void queryClient.invalidateQueries({ queryKey: queryKeys.pantry.all });
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
