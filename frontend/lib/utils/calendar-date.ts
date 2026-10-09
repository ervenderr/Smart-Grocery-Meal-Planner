const DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/;
const MS_PER_DAY = 86_400_000;

export interface CalendarDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

/**
 * Parses the calendar-date part (YYYY-MM-DD) of a date-only or ISO string without
 * any timezone conversion. Returns null for missing or impossible dates.
 */
export function parseCalendarDate(value: string | null | undefined): CalendarDate | null {
  if (typeof value !== 'string') return null;
  const match = DATE_PREFIX.exec(value.trim());
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

/** Formats the calendar date as the same day in any viewer timezone; '' if invalid. */
export function formatCalendarDate(
  value: string | null | undefined,
  options: Intl.DateTimeFormatOptions,
  locale = 'en-US',
): string {
  const parsed = parseCalendarDate(value);
  if (!parsed) return '';
  return new Date(parsed.year, parsed.month - 1, parsed.day).toLocaleDateString(locale, options);
}

/** Inclusive number of calendar days from start to end; null if either is invalid. */
export function inclusiveDayCount(
  start: string | null | undefined,
  end: string | null | undefined,
): number | null {
  const a = parseCalendarDate(start);
  const b = parseCalendarDate(end);
  if (!a || !b) return null;
  const diff = Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day);
  return Math.round(diff / MS_PER_DAY) + 1;
}

/** The viewer's local "today" as YYYY-MM-DD (not the UTC date). */
export function todayCalendarDate(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
