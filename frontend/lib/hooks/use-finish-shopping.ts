'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { shoppingApi } from '@/lib/api/shopping';
import { getApiErrorMessage } from '@/lib/api/errors';
import { haptic } from '@/lib/native/native-haptics';
import { queryKeys } from '@/lib/react-query';
import { SHOPPING_MUTATION_SCOPE } from '@/lib/hooks/use-shopping-list';
import { localIsoDate } from '@/lib/shopping/trip';
import { directThenQueue } from '@/lib/offline/direct-or-queue';
import { foldShoppingList } from '@/lib/offline/outbox/fold';
import { buildShoppingFinish } from '@/lib/offline/ops/finish-ops';
import { getOfflineRuntime, type OfflineRuntime } from '@/lib/offline/runtime';
import type {
  CarryOverMode,
  FinishShoppingInput,
  FinishShoppingResult,
  ShoppingList,
} from '@/types/shopping.types';

export const FINISH_QUEUED_COPY = "Saved. Your trip will be recorded when you're back online.";

/** queued: the trip was saved to the outbox and will be recorded on reconnect. */
export type FinishOutcome = { queued: false; result: FinishShoppingResult } | { queued: true };

export const HISTORY_PAGE_SIZE = 10;

export interface FinishShoppingVariables {
  carryOver: CarryOverMode;
  addToPantry: boolean;
}

async function applyQueuedFinish(
  queryClient: ReturnType<typeof useQueryClient>,
  enqueued: Awaited<ReturnType<OfflineRuntime['enqueue']>>
): Promise<void> {
  if (!enqueued) return;
  await queryClient.cancelQueries({ queryKey: queryKeys.shopping.active() });
  queryClient.setQueryData<ShoppingList | undefined>(queryKeys.shopping.active(), (list) =>
    list ? foldShoppingList(list, [enqueued]) : list
  );
}

export function useFinishShopping() {
  const queryClient = useQueryClient();
  return useMutation({
    // Same scope as the item writes: Finish is sent only after every earlier
    // check-off/price edit has reached the server, so the saved total matches the sheet.
    scope: SHOPPING_MUTATION_SCOPE,
    mutationFn: async ({ carryOver, addToPantry }: FinishShoppingVariables): Promise<FinishOutcome> => {
      const input: FinishShoppingInput = { carryOver, receiptDate: localIsoDate(new Date()), addToPantry };
      const runtime = getOfflineRuntime();
      if (!runtime) return { queued: false, result: await shoppingApi.finish(input) };
      const op = buildShoppingFinish({ input, now: new Date() });
      const queue = async (idempotencyKey?: string): Promise<void> => {
        const enqueued = await runtime.enqueue(op, idempotencyKey ? { idempotencyKey } : undefined);
        await applyQueuedFinish(queryClient, enqueued);
      };
      if (runtime.connectivity.getState() === 'offline') {
        await queue();
        return { queued: true };
      }
      const occurredAt = op.kind === 'shopping.finish' ? op.payload.input.occurredAt : undefined;
      const outcome = await directThenQueue({
        send: (idempotencyKey) => shoppingApi.finish({ ...input, occurredAt }, { idempotencyKey }),
        queue,
      });
      return outcome.mode === 'direct' ? { queued: false, result: outcome.result } : { queued: true };
    },
    onSuccess: async (outcome) => {
      haptic('success');
      if (outcome.queued) {
        toast.success(FINISH_QUEUED_COPY);
        return;
      }
      const { result } = outcome;
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
