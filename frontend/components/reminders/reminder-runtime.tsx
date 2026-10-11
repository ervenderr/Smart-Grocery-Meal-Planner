'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { usePantryList } from '@/lib/hooks/use-pantry';
import { loadPlugin } from '@/lib/platform/native';
import { useAuthStore } from '@/lib/stores/auth-store';
import { addReminderTapListener, getNativeReminderScheduler } from '@/lib/reminders/native-scheduler';
import { loadReminderPrefs } from '@/lib/reminders/prefs';
import { REMINDER_PREFS_EVENT } from '@/lib/reminders/use-reminders';
import type { ReminderItem } from '@/lib/reminders/types';

const SCHEDULE_ERROR_MESSAGE = "Couldn't schedule reminders. We'll retry when you reopen the app.";

/**
 * Headless native-only component: keeps the OS reminder schedule in sync with
 * cached pantry data, retries on app resume, routes notification taps and
 * cancels everything on logout. Mount only when running natively.
 */
export function ReminderRuntime() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { data: pantry } = usePantryList({});
  const [tick, setTick] = useState(0);
  const errorShown = useRef(false);
  const wasAuthenticated = useRef(isAuthenticated);

  const items = useMemo<ReminderItem[]>(
    () => (pantry ?? []).map((p) => ({ name: p.ingredientName, expiryDate: p.expiryDate })),
    [pantry],
  );
  const signature = useMemo(
    () => JSON.stringify((pantry ?? []).map((p) => [p.id, p.ingredientName, p.expiryDate ?? null])),
    [pantry],
  );

  // Re-sync when prefs change (any hook instance announces via the event) and on app resume.
  useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    window.addEventListener(REMINDER_PREFS_EVENT, bump);
    let remove: (() => void) | undefined;
    let cancelled = false;
    void loadPlugin(() => import('@capacitor/app')).then(async (mod) => {
      if (!mod) return;
      const handle = await mod.App.addListener('resume', bump);
      if (cancelled) void handle.remove();
      else remove = () => void handle.remove();
    });
    return () => {
      cancelled = true;
      window.removeEventListener(REMINDER_PREFS_EVENT, bump);
      remove?.();
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    void (async () => {
      const scheduler = await getNativeReminderScheduler();
      if (!scheduler || cancelled) return;
      const prefs = loadReminderPrefs(window.localStorage);
      const result = await scheduler.sync(items, prefs);
      if (cancelled) return;
      if (result.status === 'error' && !errorShown.current) {
        errorShown.current = true;
        toast.error(SCHEDULE_ERROR_MESSAGE);
      }
    })();
    return () => {
      cancelled = true;
    };
    // `items` is derived from the same data as `signature`; the signature gates re-runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, tick, isAuthenticated]);

  // Logout cancels every Kumaun-owned pending reminder, including when the
  // protected layout unmounts in the same tick as the sign-out.
  useEffect(() => {
    if (wasAuthenticated.current && !isAuthenticated) {
      void getNativeReminderScheduler().then((scheduler) => scheduler?.clear());
    }
    wasAuthenticated.current = isAuthenticated;
  }, [isAuthenticated]);

  useEffect(
    () => () => {
      if (wasAuthenticated.current && !useAuthStore.getState().isAuthenticated) {
        void getNativeReminderScheduler().then((scheduler) => scheduler?.clear());
      }
    },
    [],
  );

  // Notification taps arrive already allowlisted by parseNotificationRoute.
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    void addReminderTapListener((route) => router.push(route)).then((off) => {
      if (cancelled) off();
      else unsubscribe = off;
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [router]);

  return null;
}
