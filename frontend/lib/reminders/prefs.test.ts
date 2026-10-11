import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REMINDER_PREFS,
  REMINDER_PREFS_KEY,
  REMINDER_TIME_OPTIONS,
  isReminderPromptSnoozed,
  loadReminderPrefs,
  parseReminderPrefs,
  saveReminderPrefs,
  snoozeReminderPrompt,
  toggleOffset,
} from './prefs';
import type { ReminderPrefs } from './types';

const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};
const throwing = {
  getItem: () => {
    throw new Error('x');
  },
  setItem: () => {
    throw new Error('x');
  },
};

describe('parseReminderPrefs', () => {
  it.each([undefined, null, 'garbage', { enabled: true, offsets: [], time: '09:00' }, { enabled: true, offsets: [1], time: '09:15' }, { enabled: true, offsets: [9], time: '09:00' }])(
    'falls back to defaults for %j',
    (raw) => {
      expect(parseReminderPrefs(raw)).toEqual(DEFAULT_REMINDER_PREFS);
    },
  );
  it('round-trips a valid object and dedupes/sorts offsets', () => {
    expect(parseReminderPrefs({ enabled: true, offsets: [2, 0, 2], time: '18:30' })).toEqual({
      enabled: true,
      offsets: [0, 2],
      time: '18:30',
    });
  });
  it('has 48 half-hour options', () => {
    expect(REMINDER_TIME_OPTIONS).toHaveLength(48);
  });
  it('defaults are disabled', () => {
    expect(DEFAULT_REMINDER_PREFS.enabled).toBe(false);
  });
});

describe('load/save', () => {
  it('saves and loads', () => {
    const s = mem();
    const prefs: ReminderPrefs = { enabled: true, offsets: [0, 1], time: '08:00' };
    expect(saveReminderPrefs(s, prefs)).toBe(true);
    expect(loadReminderPrefs(s)).toEqual(prefs);
  });
  it('corrupt JSON gives defaults', () => {
    const s = mem();
    s.setItem(REMINDER_PREFS_KEY, '{nope');
    expect(loadReminderPrefs(s)).toEqual(DEFAULT_REMINDER_PREFS);
  });
});

describe('toggleOffset', () => {
  it('blocks removing the last offset', () => {
    const prefs = Object.freeze({ enabled: true, offsets: Object.freeze([1] as const), time: '09:00' }) as ReminderPrefs;
    const r = toggleOffset(prefs, 1);
    expect(r.blocked).toBe(true);
    expect(r.prefs).toBe(prefs);
  });
  it('adds without mutating', () => {
    const prefs = Object.freeze({ enabled: true, offsets: Object.freeze([1] as const), time: '09:00' }) as ReminderPrefs;
    const r = toggleOffset(prefs, 0);
    expect(r.blocked).toBe(false);
    expect(r.prefs.offsets).toEqual([0, 1]);
    expect(prefs.offsets).toEqual([1]);
  });
  it('removes when more than one remain', () => {
    const r = toggleOffset({ enabled: true, offsets: [0, 1], time: '09:00' }, 0);
    expect(r.prefs.offsets).toEqual([1]);
  });
});

describe('snooze', () => {
  const now = new Date(2026, 9, 11, 12);
  it('snoozes for 14 days', () => {
    const s = mem();
    expect(isReminderPromptSnoozed(s, now)).toBe(false);
    snoozeReminderPrompt(s, now);
    expect(isReminderPromptSnoozed(s, new Date(now.getTime() + 13 * 86_400_000))).toBe(true);
    expect(isReminderPromptSnoozed(s, new Date(now.getTime() + 14 * 86_400_000 + 1))).toBe(false);
  });
  it('does not throw when storage throws', () => {
    expect(() => snoozeReminderPrompt(throwing, now)).not.toThrow();
    expect(isReminderPromptSnoozed(throwing, now)).toBe(false);
  });
});
