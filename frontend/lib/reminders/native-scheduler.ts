import { loadPlugin } from '@/lib/platform/native';
import { createReminderScheduler } from './scheduler';
import { parseNotificationRoute } from './route';
import type { LocalNotificationsLike } from './types';

type Scheduler = ReturnType<typeof createReminderScheduler>;

let cached: Promise<Scheduler | null> | null = null;

const loadModule = () => loadPlugin(() => import('@capacitor/local-notifications'));

/** Scheduler bound to the native plugin; null on web. */
export function getNativeReminderScheduler(): Promise<Scheduler | null> {
  if (!cached) {
    cached = loadModule().then((mod) => {
      if (!mod) return null;
      const plugin: LocalNotificationsLike = {
        checkPermissions: () => mod.LocalNotifications.checkPermissions(),
        requestPermissions: () => mod.LocalNotifications.requestPermissions(),
        getPending: () => mod.LocalNotifications.getPending(),
        cancel: (o) => mod.LocalNotifications.cancel(o),
        schedule: (o) =>
          mod.LocalNotifications.schedule(o as Parameters<typeof mod.LocalNotifications.schedule>[0]),
      };
      return createReminderScheduler({ plugin, now: () => new Date() });
    });
  }
  return cached;
}

/** Listen for notification taps; only allowlisted routes reach onRoute. No-op on web. */
export async function addReminderTapListener(onRoute: (route: string) => void): Promise<() => void> {
  const mod = await loadModule();
  if (!mod) return () => undefined;
  const handle = await mod.LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
    const route = parseNotificationRoute(event.notification.extra);
    if (route) onRoute(route);
  });
  return () => {
    void handle.remove();
  };
}
