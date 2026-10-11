import { buildReminderPlan, isReminderId } from './plan';
import type {
  LocalNotificationsLike,
  PermissionDisplay,
  ReminderItem,
  ReminderPrefs,
  SyncResult,
} from './types';

export interface ReminderSchedulerDeps {
  plugin: LocalNotificationsLike;
  now: () => Date;
}

function logError(context: string, error: unknown): void {
  console.error(`Reminder ${context} failed:`, error instanceof Error ? error.message : 'unknown');
}

export function createReminderScheduler(deps: ReminderSchedulerDeps) {
  const { plugin, now } = deps;
  let chain: Promise<unknown> = Promise.resolve();

  async function cancelOwn(): Promise<void> {
    const pending = await plugin.getPending();
    const own = pending.notifications.filter((n) => isReminderId(n.id)).map((n) => ({ id: n.id }));
    if (own.length > 0) await plugin.cancel({ notifications: own });
  }

  async function doSync(items: readonly ReminderItem[], prefs: ReminderPrefs): Promise<SyncResult> {
    try {
      if (!prefs.enabled) {
        await cancelOwn();
        return { status: 'disabled', scheduled: 0 };
      }
      // Pitfall 3: schedule() auto-prompts, so only proceed when already granted.
      const { display } = await plugin.checkPermissions();
      if (display !== 'granted') return { status: 'not-granted', scheduled: 0 };
      const plan = buildReminderPlan(items, prefs, now());
      await cancelOwn();
      if (plan.length === 0) return { status: 'scheduled', scheduled: 0 };
      await plugin.schedule({
        notifications: plan.map((n) => ({
          id: n.id,
          title: n.title,
          body: n.body,
          schedule: { at: n.fireAt },
          extra: { route: n.route },
        })),
      });
      return { status: 'scheduled', scheduled: plan.length };
    } catch (error) {
      logError('sync', error);
      return { status: 'error', scheduled: 0 };
    }
  }

  return {
    sync(items: readonly ReminderItem[], prefs: ReminderPrefs): Promise<SyncResult> {
      const run = chain.then(() => doSync(items, prefs));
      chain = run.catch(() => undefined);
      return run;
    },
    async clear(): Promise<void> {
      try {
        await cancelOwn();
      } catch (error) {
        logError('clear', error);
      }
    },
    async checkPermission(): Promise<PermissionDisplay | 'unknown'> {
      try {
        return (await plugin.checkPermissions()).display;
      } catch (error) {
        logError('permission check', error);
        return 'unknown';
      }
    },
    async requestOptIn(): Promise<'granted' | 'denied'> {
      try {
        return (await plugin.requestPermissions()).display === 'granted' ? 'granted' : 'denied';
      } catch (error) {
        logError('permission request', error);
        return 'denied';
      }
    },
  };
}
