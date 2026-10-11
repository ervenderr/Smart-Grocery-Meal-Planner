import { afterAll, describe, expect, it } from 'vitest';
import {
  EXPIRING_ROUTE,
  MAX_PENDING_REMINDERS,
  REMINDER_ID_BASE,
  buildReminderPlan,
  formatReminderBody,
  isReminderId,
  sanitizeName,
} from './plan';
import type { ReminderItem, ReminderOffset, ReminderPrefs } from './types';

const ZONES = ['America/Los_Angeles', 'Asia/Manila', 'Pacific/Kiritimati', 'UTC'];
const originalTz = process.env.TZ;
afterAll(() => {
  if (originalTz === undefined) delete process.env.TZ;
  else process.env.TZ = originalTz;
});

const prefs = (offsets: ReminderOffset[], time = '09:00', enabled = true): ReminderPrefs => ({ enabled, offsets, time });

describe('pure helpers', () => {
  it('sanitizes names', () => {
    expect(sanitizeName('  Greek   \n yogurt ')).toBe('Greek yogurt');
    const long = sanitizeName('x'.repeat(60));
    expect(long).toHaveLength(40);
    expect(long.endsWith('…')).toBe(true);
  });
  it('formats bodies', () => {
    expect(formatReminderBody(['Milk'], 1)).toBe('Milk expires tomorrow');
    expect(formatReminderBody(['A', 'B'], 0)).toBe('2 items expire today: A, B');
    expect(formatReminderBody(['A', 'B', 'C', 'D', 'E'], 3)).toBe('5 items expire in 3 days: A, B, C and 2 more');
  });
  it('isReminderId bounds', () => {
    expect(isReminderId(REMINDER_ID_BASE)).toBe(true);
    expect(isReminderId(REMINDER_ID_BASE + 59)).toBe(true);
    expect(isReminderId(REMINDER_ID_BASE + 60)).toBe(false);
    expect(isReminderId(5)).toBe(false);
  });
});

describe.each(ZONES)('buildReminderPlan in %s', (tz) => {
  const run = <T>(fn: () => T): T => {
    process.env.TZ = tz;
    return fn();
  };
  const now = () => new Date(2026, 9, 10, 8, 0); // Oct 10 08:00 local
  const milk: ReminderItem = { name: 'Milk', expiryDate: '2026-10-12' };

  it('one notification tomorrow 09:00 for item expiring in 2 days, offset 1', () => {
    const out = run(() => buildReminderPlan([milk], prefs([1]), now()));
    expect(out).toHaveLength(1);
    expect(out[0].fireAt.getTime()).toBe(new Date(2026, 9, 11, 9, 0).getTime());
    expect(out[0].body).toBe('Milk expires tomorrow');
    expect(out[0].title).toBe('Kumaun');
    expect(out[0].route).toBe(EXPIRING_ROUTE);
    expect(out[0].id).toBe(REMINDER_ID_BASE);
  });
  it.each([
    [0, 'Milk expires today'],
    [2, 'Milk expires in 2 days'],
  ] as const)('offset %i body', (offset, body) => {
    const out = run(() => buildReminderPlan([{ name: 'Milk', expiryDate: '2026-10-14' }], prefs([offset as ReminderOffset]), now()));
    expect(out[0].body).toBe(body);
  });
  it('offset 3 says in 3 days', () => {
    const out = run(() => buildReminderPlan([{ name: 'Milk', expiryDate: '2026-10-14' }], prefs([3]), now()));
    expect(out[0].body).toBe('Milk expires in 3 days');
  });
  it('groups three items alphabetically', () => {
    const items = ['Spinach', 'Eggs', 'Milk'].map((name) => ({ name, expiryDate: '2026-10-12' }));
    const out = run(() => buildReminderPlan(items, prefs([1]), now()));
    expect(out).toHaveLength(1);
    expect(out[0].body).toBe('3 items expire tomorrow: Eggs, Milk, Spinach');
  });
  it('groups five items with "and 2 more"', () => {
    const items = ['E', 'D', 'C', 'B', 'A'].map((name) => ({ name, expiryDate: '2026-10-12' }));
    const out = run(() => buildReminderPlan(items, prefs([1]), now()));
    expect(out[0].body).toBe('5 items expire tomorrow: A, B, C and 2 more');
  });
  it('skips fire times in the past', () => {
    const late = new Date(2026, 9, 10, 10, 0);
    const out = run(() => buildReminderPlan([{ name: 'Milk', expiryDate: '2026-10-10' }], prefs([0]), late));
    expect(out).toEqual([]);
  });
  it('skips expired, null and invalid dates', () => {
    const items: ReminderItem[] = [
      { name: 'Old', expiryDate: '2026-10-01' },
      { name: 'None', expiryDate: null },
      { name: 'Bad', expiryDate: 'nope' },
      { name: 'Feb', expiryDate: '2026-02-31' },
    ];
    expect(run(() => buildReminderPlan(items, prefs([0, 1]), now()))).toEqual([]);
  });
  it('separate notifications per offset', () => {
    const out = run(() => buildReminderPlan([milk], prefs([0, 1]), now()));
    expect(out.map((n) => n.body)).toEqual(['Milk expires tomorrow', 'Milk expires today']);
  });
  it('caps at 60, earliest first, ids sequential', () => {
    const items = Array.from({ length: 80 }, (_, i) => ({
      name: `Item${i}`,
      expiryDate: new Date(2026, 9, 11 + i).toISOString().slice(0, 10),
    }));
    const dated = items.map((it, i) => {
      const d = new Date(2026, 9, 11 + i);
      return { ...it, expiryDate: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` };
    });
    const out = run(() => buildReminderPlan(dated, prefs([0]), now()));
    expect(out).toHaveLength(MAX_PENDING_REMINDERS);
    out.forEach((n, i) => {
      expect(n.id).toBe(REMINDER_ID_BASE + i);
      expect(isReminderId(n.id)).toBe(true);
      if (i > 0) expect(n.fireAt.getTime()).toBeGreaterThan(out[i - 1].fireAt.getTime());
    });
  });
  it('disabled prefs yield nothing', () => {
    expect(run(() => buildReminderPlan([milk], prefs([1], '09:00', false), now()))).toEqual([]);
  });
  it('trims names and does not mutate input', () => {
    const items = Object.freeze([Object.freeze({ name: '  Milk  ', expiryDate: '2026-10-12' })]);
    const out = run(() => buildReminderPlan(items, prefs([1]), now()));
    expect(out[0].body).toBe('Milk expires tomorrow');
    expect(items).toHaveLength(1);
  });
  it('honors a 30-minute time', () => {
    const out = run(() => buildReminderPlan([milk], prefs([1], '18:30'), now()));
    expect(out[0].fireAt.getTime()).toBe(new Date(2026, 9, 11, 18, 30).getTime());
  });
});
