import { z } from 'zod';
import { safeGetItem, safeSetItem, type StorageLike } from '@/lib/pwa/storage';
import type { ReminderOffset, ReminderPrefs } from './types';

export const REMINDER_PREFS_KEY = 'kitcha:reminder-prefs';
export const REMINDER_SNOOZE_KEY = 'kitcha:reminder-snooze-until';
export const SNOOZE_DAYS = 14;
const MS_PER_DAY = 86_400_000;

export const DEFAULT_REMINDER_PREFS: ReminderPrefs = Object.freeze({
  enabled: false,
  offsets: Object.freeze([1 as ReminderOffset]),
  time: '09:00',
});

export const REMINDER_TIME_OPTIONS: readonly string[] = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, '0');
  return `${h}:${i % 2 === 0 ? '00' : '30'}`;
});

const offsetSchema = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);

export const reminderPrefsSchema = z.object({
  enabled: z.boolean(),
  offsets: z
    .array(offsetSchema)
    .min(1)
    .transform((o) => [...new Set(o)].sort((a, b) => a - b) as ReminderOffset[]),
  time: z.string().refine((t) => REMINDER_TIME_OPTIONS.includes(t)),
});

export function parseReminderPrefs(raw: unknown): ReminderPrefs {
  const result = reminderPrefsSchema.safeParse(raw);
  return result.success ? result.data : DEFAULT_REMINDER_PREFS;
}

export function loadReminderPrefs(storage: StorageLike | undefined): ReminderPrefs {
  const text = safeGetItem(storage, REMINDER_PREFS_KEY);
  if (text === null) return DEFAULT_REMINDER_PREFS;
  try {
    return parseReminderPrefs(JSON.parse(text));
  } catch {
    return DEFAULT_REMINDER_PREFS;
  }
}

export function saveReminderPrefs(storage: StorageLike | undefined, prefs: ReminderPrefs): boolean {
  return safeSetItem(storage, REMINDER_PREFS_KEY, JSON.stringify(parseReminderPrefs(prefs)));
}

/** Toggle an offset; the last remaining offset can never be removed. */
export function toggleOffset(
  prefs: ReminderPrefs,
  offset: ReminderOffset,
): { prefs: ReminderPrefs; blocked: boolean } {
  if (prefs.offsets.includes(offset)) {
    if (prefs.offsets.length <= 1) return { prefs, blocked: true };
    return { prefs: { ...prefs, offsets: prefs.offsets.filter((o) => o !== offset) }, blocked: false };
  }
  const offsets = [...prefs.offsets, offset].sort((a, b) => a - b);
  return { prefs: { ...prefs, offsets }, blocked: false };
}

export function snoozeReminderPrompt(storage: StorageLike | undefined, now: Date): void {
  safeSetItem(storage, REMINDER_SNOOZE_KEY, String(now.getTime() + SNOOZE_DAYS * MS_PER_DAY));
}

export function isReminderPromptSnoozed(storage: StorageLike | undefined, now: Date): boolean {
  const until = Number(safeGetItem(storage, REMINDER_SNOOZE_KEY));
  return Number.isFinite(until) && until > 0 && now.getTime() < until;
}
