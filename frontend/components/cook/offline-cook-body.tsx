'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { WifiOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { QuantityStepper } from '@/components/pantry/quantity-stepper';
import { COOK_QUEUED_TOAST, queueCook } from '@/components/cook/queue-cook';
import { RECIPES_ALL_KEY } from '@/lib/offline/cache/cache-keys';
import type { Recipe } from '@/types/recipe.types';
import { haptic } from '@/lib/native/native-haptics';
import { getOfflineRuntime } from '@/lib/offline/runtime';
import type { CookTarget } from '@/types/cook.types';

interface OfflineCookBodyProps {
  onClose: () => void;
  target: CookTarget;
  title: string;
  plannedServings?: number;
  onCooked?: () => void;
}

const OFFLINE_COPY = "You're offline. Your pantry will be updated when you're back online.";
const QUEUE_ERROR_COPY = "We couldn't save that. Try again.";

/** Cooked it while offline: pick servings, queue the cook, update the pantry on reconnect. */
export function OfflineCookBody({ onClose, target, title, plannedServings, onCooked }: OfflineCookBodyProps) {
  const queryClient = useQueryClient();
  const [servings, setServings] = useState(
    () =>
      plannedServings ??
      ('recipeId' in target
        ? queryClient.getQueryData<Recipe[]>(RECIPES_ALL_KEY)?.find((r) => r.id === target.recipeId)?.servings
        : undefined) ??
      1
  );
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const runtime = getOfflineRuntime();
    if (!runtime || saving) return;
    setSaving(true);
    try {
      await queueCook({ runtime, queryClient, target, servings, title });
      haptic('success');
      toast.success(COOK_QUEUED_TOAST);
      onCooked?.();
      onClose();
    } catch {
      toast.error(QUEUE_ERROR_COPY);
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="truncate text-base text-gray-600">{title}</p>
      <div
        role="status"
        className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
      >
        <WifiOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        {OFFLINE_COPY}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-gray-900">Servings you cooked</p>
        <QuantityStepper
          value={servings}
          unitLabel={servings === 1 ? 'serving' : 'servings'}
          step={1}
          min={1}
          max={99}
          label="Servings"
          onChange={setServings}
          disabled={saving}
          announce={false}
        />
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onClose} disabled={saving}>
          Close
        </Button>
        <Button onClick={() => void submit()} disabled={saving}>
          Mark as cooked
        </Button>
      </div>
    </div>
  );
}
