'use client';

import { useCallback, useEffect, useState } from 'react';
import { loadPlugin } from '@/lib/platform/native';
import { usePlatform } from '@/lib/platform/use-platform';
import { getNativeReminderScheduler } from './native-scheduler';
import {
  DEFAULT_REMINDER_PREFS,
  isReminderPromptSnoozed,
  loadReminderPrefs,
  saveReminderPrefs,
  snoozeReminderPrompt,
} from './prefs';
import type { PermissionDisplay, ReminderPrefs } from './types';

export const REMINDER_PREFS_EVENT = 'kitcha:reminder-prefs-changed';
/** iOS deep link to this app's Settings page; WKWebView hands unknown schemes to the OS. */
const APP_SETTINGS_URL = 'app-settings:';

type Permission = PermissionDisplay | 'unknown';

export interface UseRemindersResult {
  native: boolean;
  permission: Permission;
  prefs: ReminderPrefs;
  updatePrefs(next: ReminderPrefs): void;
  enable(): Promise<'granted' | 'denied'>;
  openSettings(): Promise<void>;
  snooze(): void;
  snoozed: boolean;
  refreshPermission(): Promise<void>;
}

function getStorage(): Storage | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function persistAndAnnounce(prefs: ReminderPrefs): void {
  saveReminderPrefs(getStorage(), prefs);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(REMINDER_PREFS_EVENT));
}

/**
 * Reminder permission, preferences and snooze state. Safe no-op on web.
 * The OS permission prompt is only reachable through enable(), which the
 * explainer sheet calls from its "Turn on reminders" button.
 */
export function useReminders(): UseRemindersResult {
  const { native } = usePlatform();
  const [permission, setPermission] = useState<Permission>('unknown');
  const [prefs, setPrefs] = useState<ReminderPrefs>(DEFAULT_REMINDER_PREFS);
  const [snoozed, setSnoozed] = useState(false);

  const refreshPermission = useCallback(async () => {
    if (!native) return;
    const scheduler = await getNativeReminderScheduler();
    if (!scheduler) return;
    try {
      setPermission(await scheduler.checkPermission());
    } catch {
      setPermission('unknown');
    }
  }, [native]);

  useEffect(() => {
    if (!native) return;
    const storage = getStorage();
    const read = () => {
      setPrefs(loadReminderPrefs(storage));
      setSnoozed(isReminderPromptSnoozed(storage, new Date()));
    };
    read();
    window.addEventListener(REMINDER_PREFS_EVENT, read);
    return () => window.removeEventListener(REMINDER_PREFS_EVENT, read);
  }, [native]);

  useEffect(() => {
    if (!native) return;
    let remove: (() => void) | undefined;
    let cancelled = false;
    void refreshPermission();
    void loadPlugin(() => import('@capacitor/app')).then(async (mod) => {
      if (!mod) return;
      const handle = await mod.App.addListener('resume', () => void refreshPermission());
      if (cancelled) void handle.remove();
      else remove = () => void handle.remove();
    });
    return () => {
      cancelled = true;
      remove?.();
    };
  }, [native, refreshPermission]);

  const updatePrefs = useCallback(
    (next: ReminderPrefs) => {
      if (!native) return;
      setPrefs(next);
      persistAndAnnounce(next);
    },
    [native],
  );

  const enable = useCallback(async (): Promise<'granted' | 'denied'> => {
    if (!native) return 'denied';
    const scheduler = await getNativeReminderScheduler();
    if (!scheduler) return 'denied';
    let result: 'granted' | 'denied';
    try {
      result = await scheduler.requestOptIn();
    } catch {
      result = 'denied';
    }
    setPermission(result);
    if (result === 'granted') {
      const next = { ...loadReminderPrefs(getStorage()), enabled: true };
      setPrefs(next);
      persistAndAnnounce(next);
    }
    return result;
  }, [native]);

  const openSettings = useCallback(async () => {
    if (!native || typeof window === 'undefined') return;
    window.location.assign(APP_SETTINGS_URL);
  }, [native]);

  const snooze = useCallback(() => {
    if (!native) return;
    snoozeReminderPrompt(getStorage(), new Date());
    setSnoozed(true);
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(REMINDER_PREFS_EVENT));
  }, [native]);

  return { native, permission, prefs, updatePrefs, enable, openSettings, snooze, snoozed, refreshPermission };
}
