import { getDaysUntilExpiry } from '@/lib/pantry/expiry';
import type { ReminderItem, ReminderNotification, ReminderOffset, ReminderPrefs } from './types';

export const REMINDER_ID_BASE = 910000;
export const MAX_PENDING_REMINDERS = 60;
export const EXPIRING_ROUTE = '/pantry/?filter=expiring';
const MAX_NAME_LENGTH = 40;
const MAX_LISTED_NAMES = 3;
const DATE_PARTS = /^(\d{4})-(\d{2})-(\d{2})/;

export function isReminderId(id: number): boolean {
  return Number.isInteger(id) && id >= REMINDER_ID_BASE && id < REMINDER_ID_BASE + MAX_PENDING_REMINDERS;
}

export function sanitizeName(name: string): string {
  const clean = name.replace(/\s+/g, ' ').trim();
  return clean.length > MAX_NAME_LENGTH ? `${clean.slice(0, MAX_NAME_LENGTH - 1).trimEnd()}…` : clean;
}

function whenPhrase(offset: ReminderOffset): string {
  if (offset === 0) return 'today';
  if (offset === 1) return 'tomorrow';
  return `in ${offset} days`;
}

export function formatReminderBody(names: readonly string[], offset: ReminderOffset): string {
  const when = whenPhrase(offset);
  if (names.length === 1) return `${names[0]} expires ${when}`;
  const listed = names.slice(0, MAX_LISTED_NAMES).join(', ');
  const extra = names.length - MAX_LISTED_NAMES;
  const tail = extra > 0 ? ` and ${extra} more` : '';
  return `${names.length} items expire ${when}: ${listed}${tail}`;
}

interface Group {
  readonly fireAt: Date;
  readonly offset: ReminderOffset;
  readonly names: string[];
}

function fireTime(expiry: string, offset: number, time: string): Date | null {
  const m = DATE_PARTS.exec(expiry.trim());
  if (!m) return null;
  const [hh, mm] = time.split(':').map(Number);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) - offset, hh, mm);
}

export function buildReminderPlan(
  items: readonly ReminderItem[],
  prefs: ReminderPrefs,
  now: Date,
): ReminderNotification[] {
  if (!prefs.enabled) return [];
  const groups = new Map<string, Group>();
  for (const item of items) {
    const days = getDaysUntilExpiry(item.expiryDate, now);
    if (days === null || days < 0 || typeof item.expiryDate !== 'string') continue;
    const name = sanitizeName(item.name);
    if (!name) continue;
    for (const offset of prefs.offsets) {
      const fireAt = fireTime(item.expiryDate, offset, prefs.time);
      if (!fireAt || fireAt.getTime() <= now.getTime()) continue;
      const key = `${fireAt.getTime()}:${offset}`;
      const existing = groups.get(key);
      if (existing) existing.names.push(name);
      else groups.set(key, { fireAt, offset, names: [name] });
    }
  }
  return [...groups.entries()]
    .sort(([ka, a], [kb, b]) => a.fireAt.getTime() - b.fireAt.getTime() || (ka < kb ? -1 : ka > kb ? 1 : 0))
    .slice(0, MAX_PENDING_REMINDERS)
    .map(([, g], index) =>
      Object.freeze({
        id: REMINDER_ID_BASE + index,
        title: 'Kitcha' as const,
        body: formatReminderBody([...g.names].sort((a, b) => a.localeCompare(b, 'en')), g.offset),
        fireAt: g.fireAt,
        route: EXPIRING_ROUTE,
      }),
    );
}
