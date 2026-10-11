import { describe, expect, it, vi } from 'vitest';
import { createReminderScheduler } from './scheduler';
import { REMINDER_ID_BASE } from './plan';
import type { LocalNotificationsLike, PermissionDisplay, ReminderItem, ReminderPrefs } from './types';

const now = new Date(2026, 9, 10, 8, 0);
const prefs: ReminderPrefs = { enabled: true, offsets: [1], time: '09:00' };
const items: ReminderItem[] = [{ name: 'Milk', expiryDate: '2026-10-12' }];

function makePlugin(display: PermissionDisplay = 'granted', pending: number[] = [5, REMINDER_ID_BASE, REMINDER_ID_BASE + 1]) {
  return {
    checkPermissions: vi.fn(async () => ({ display })),
    requestPermissions: vi.fn(async () => ({ display })),
    getPending: vi.fn(async () => ({ notifications: pending.map((id) => ({ id })) })),
    cancel: vi.fn(async (_o: { notifications: { id: number }[] }) => undefined),
    schedule: vi.fn(async () => ({})),
  } satisfies LocalNotificationsLike;
}
const make = (p: LocalNotificationsLike) => createReminderScheduler({ plugin: p, now: () => now });

describe('createReminderScheduler', () => {
  it('disabled prefs cancel own ids and report disabled', async () => {
    const p = makePlugin();
    const r = await make(p).sync(items, { ...prefs, enabled: false });
    expect(r).toEqual({ status: 'disabled', scheduled: 0 });
    expect(p.cancel).toHaveBeenCalledWith({ notifications: [{ id: REMINDER_ID_BASE }, { id: REMINDER_ID_BASE + 1 }] });
    expect(p.schedule).not.toHaveBeenCalled();
  });

  it.each(['prompt', 'prompt-with-rationale', 'denied'] as const)('never schedules or prompts when %s', async (d) => {
    const p = makePlugin(d);
    const r = await make(p).sync(items, prefs);
    expect(r.status).toBe('not-granted');
    expect(p.schedule).toHaveBeenCalledTimes(0);
    expect(p.requestPermissions).toHaveBeenCalledTimes(0);
  });

  it('granted: cancels only own ids then schedules mapped notifications', async () => {
    const p = makePlugin();
    const r = await make(p).sync(items, prefs);
    expect(r).toEqual({ status: 'scheduled', scheduled: 1 });
    const cancelArg = p.cancel.mock.calls[0][0] as { notifications: { id: number }[] };
    expect(cancelArg.notifications.map((n) => n.id)).not.toContain(5);
    expect(p.schedule).toHaveBeenCalledWith({
      notifications: [
        {
          id: REMINDER_ID_BASE,
          title: 'Kumaun',
          body: 'Milk expires tomorrow',
          schedule: { at: new Date(2026, 9, 11, 9, 0) },
          extra: { route: '/pantry/?filter=expiring' },
        },
      ],
    });
  });

  it('granted with empty plan cancels but does not schedule', async () => {
    const p = makePlugin();
    const r = await make(p).sync([], prefs);
    expect(r).toEqual({ status: 'scheduled', scheduled: 0 });
    expect(p.cancel).toHaveBeenCalled();
    expect(p.schedule).not.toHaveBeenCalled();
  });

  it('schedule rejection returns error without throwing', async () => {
    const p = makePlugin();
    p.schedule.mockRejectedValueOnce(new Error('boom'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(make(p).sync(items, prefs)).resolves.toEqual({ status: 'error', scheduled: 0 });
    spy.mockRestore();
  });

  it('serializes overlapping syncs', async () => {
    const p = makePlugin();
    const order: string[] = [];
    let release!: () => void;
    p.checkPermissions.mockImplementationOnce(
      () =>
        new Promise((res) => {
          order.push('first-start');
          release = () => {
            order.push('first-end');
            res({ display: 'granted' });
          };
        }),
    );
    p.checkPermissions.mockImplementationOnce(async () => {
      order.push('second-start');
      return { display: 'granted' as const };
    });
    const s = make(p);
    const a = s.sync(items, prefs);
    const b = s.sync(items, prefs);
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 5));
    expect(order).toEqual(['first-start']);
    release();
    await Promise.all([a, b]);
    expect(order).toEqual(['first-start', 'first-end', 'second-start']);
  });

  it('clear cancels only own ids', async () => {
    const p = makePlugin();
    await make(p).clear();
    expect(p.cancel).toHaveBeenCalledWith({ notifications: [{ id: REMINDER_ID_BASE }, { id: REMINDER_ID_BASE + 1 }] });
  });

  it('requestOptIn maps results', async () => {
    expect(await make(makePlugin('granted')).requestOptIn()).toBe('granted');
    expect(await make(makePlugin('denied')).requestOptIn()).toBe('denied');
    expect(await make(makePlugin('prompt')).requestOptIn()).toBe('denied');
  });

  it('checkPermission returns unknown when plugin throws', async () => {
    const p = makePlugin();
    p.checkPermissions.mockRejectedValueOnce(new Error('x'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await make(p).checkPermission()).toBe('unknown');
    spy.mockRestore();
  });
});
