import type { ExpiringItem, ExpiryStatus, PantryItem } from '@/types/pantry.types';

const MS_PER_DAY = 86_400_000;
const DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/;

/** Items with this many days left or fewer are "critical". */
export const CRITICAL_DAYS = 2;
/** Items with this many days left or fewer are "warning". */
export const WARNING_DAYS = 7;

/** UTC-midnight day number for a calendar date, or null if it does not exist. */
function toDayNumber(year: number, month: number, day: number): number | null {
  const ms = Date.UTC(year, month - 1, day);
  const check = new Date(ms);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return ms / MS_PER_DAY;
}

/**
 * Whole calendar days from "today" (the viewer's local date) until the
 * expiry date. Only the date part of the expiry value is used, so the
 * result is independent of timezone and time of day. Negative = expired.
 * Returns null when there is no usable date.
 */
export function getDaysUntilExpiry(
  expiryDate: string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (typeof expiryDate !== 'string') return null;
  const match = DATE_PREFIX.exec(expiryDate.trim());
  if (!match) return null;
  const expiry = toDayNumber(Number(match[1]), Number(match[2]), Number(match[3]));
  const today = toDayNumber(now.getFullYear(), now.getMonth() + 1, now.getDate());
  if (expiry === null || today === null) return null;
  return expiry - today;
}

export function getExpiryStatus(daysUntilExpiry: number): ExpiryStatus {
  if (daysUntilExpiry < 0) return 'expired';
  if (daysUntilExpiry <= CRITICAL_DAYS) return 'critical';
  if (daysUntilExpiry <= WARNING_DAYS) return 'warning';
  return 'ok';
}

export function formatExpiryLabel(daysUntilExpiry: number): string {
  if (daysUntilExpiry < 0) return 'Expired';
  if (daysUntilExpiry === 0) return 'Today';
  return `${daysUntilExpiry}d left`;
}

function isPantryItemLike(value: unknown): value is PantryItem {
  return typeof value === 'object' && value !== null && 'id' in value;
}

/**
 * Turn the flat items returned by GET /pantry/expiring-soon into display
 * entries with client-computed days/status, soonest first. Items with a
 * missing or invalid expiry date are dropped.
 */
export function toExpiringItems(payload: unknown, now: Date = new Date()): ExpiringItem[] {
  if (!Array.isArray(payload)) return [];
  const entries: ExpiringItem[] = [];
  for (const raw of payload) {
    if (!isPantryItemLike(raw)) continue;
    const days = getDaysUntilExpiry(raw.expiryDate, now);
    if (days === null) continue;
    entries.push({ item: raw, daysUntilExpiry: days, status: getExpiryStatus(days) });
  }
  return entries.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** Local calendar date as YYYY-MM-DD (never UTC-shifted). */
export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Today's local date as YYYY-MM-DD. */
export function todayIso(now: Date = new Date()): string {
  return toIsoDate(now);
}

/**
 * Expiry shortcut: base is `current` when it is a valid YYYY-MM-DD on or
 * after today, otherwise today. Returns base + days as YYYY-MM-DD.
 */
export function addDaysShortcut(
  current: string | null | undefined,
  days: number,
  now: Date = new Date(),
): string {
  const today = todayIso(now);
  const untilCurrent = getDaysUntilExpiry(current, now);
  const match =
    typeof current === 'string' ? DATE_PREFIX.exec(current.trim()) : null;
  const useCurrent = match !== null && untilCurrent !== null && untilCurrent >= 0;
  const [y, m, d] = (useCurrent && match ? [match[1], match[2], match[3]] : today.split('-')).map(
    Number,
  );
  return toIsoDate(new Date(y, m - 1, d + days));
}

/**
 * Display string for a date-only expiry value, built from the calendar
 * date parts so it never shifts with the viewer's timezone. Empty string
 * when the value is missing or invalid.
 */
export function formatExpiryDate(
  expiryDate: string | null | undefined,
  locale?: string,
): string {
  if (typeof expiryDate !== 'string') return '';
  const match = DATE_PREFIX.exec(expiryDate.trim());
  if (!match) return '';
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (toDayNumber(y, m, d) === null) return '';
  return new Date(y, m - 1, d).toLocaleDateString(locale);
}

export interface ExpiryBadge {
  status: Exclude<ExpiryStatus, 'ok'>;
  label: string;
  color: string;
}

/** Badge for items that are expired or expiring within a week; null otherwise. */
export function getExpiryBadge(
  expiryDate: string | null | undefined,
  now: Date = new Date(),
): ExpiryBadge | null {
  const days = getDaysUntilExpiry(expiryDate, now);
  if (days === null) return null;
  const status = getExpiryStatus(days);
  if (status === 'ok') return null;
  if (status === 'expired') {
    return { status, label: 'Expired', color: 'text-red-600 bg-red-50' };
  }
  const label = days === 0 ? 'Expires today' : `${days} ${days === 1 ? 'day' : 'days'} left`;
  return {
    status,
    label,
    color: status === 'warning' ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50',
  };
}
