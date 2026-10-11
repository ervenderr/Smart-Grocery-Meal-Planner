'use client';

import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { haptic } from '@/lib/native/native-haptics';
import type { DrainEvent } from '@/lib/offline/outbox/drain';
import { whenOfflineRuntime } from '@/lib/offline/runtime';
import { openPendingSheet } from '@/lib/offline/status/sheet-store';
import { planDrainToasts, type PlannedToast } from '@/lib/offline/status/toast-plan';

function showToast(t: PlannedToast): void {
  if (t.kind === 'attention') {
    toast.custom(
      (instance) => (
        <button
          type="button"
          onClick={() => {
            toast.dismiss(instance.id);
            openPendingSheet();
          }}
          className="touch-target flex min-h-11 items-center rounded-lg bg-white px-4 text-sm font-semibold text-red-800 shadow-lg"
        >
          {t.message}
        </button>
      ),
      { duration: 5000 },
    );
    return;
  }
  if (t.kind === 'success') toast.success(t.message);
  else toast(t.message);
}

/** Renders nothing: turns drain events into one aggregated toast set per run, plus haptics. */
export function SyncFeedback() {
  useEffect(() => {
    let buffer: DrainEvent[] = [];
    let unsubscribe: (() => void) | null = null;
    const cancelWait = whenOfflineRuntime((runtime) => {
      unsubscribe = runtime.onEvent((e) => {
        if (e.type === 'started') {
          buffer = [];
          return;
        }
        if (e.type === 'applied' && e.op.attempts > 0) haptic('success');
        if (e.type === 'parked') haptic('warning');
        if (e.type === 'applied' || e.type === 'parked') {
          buffer = [...buffer, e];
          return;
        }
        if (e.type === 'finished') {
          const run = buffer;
          buffer = [];
          planDrainToasts(run).forEach(showToast);
        }
      });
    });
    return () => {
      cancelWait();
      unsubscribe?.();
    };
  }, []);

  return null;
}
