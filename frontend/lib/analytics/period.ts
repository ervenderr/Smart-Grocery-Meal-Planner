/**
 * Parsing/formatting of the period keys produced by the backend
 * (AnalyticsService.getPeriodKey):
 *   daily   -> 'YYYY-MM-DD'
 *   weekly  -> 'YYYY-Www'  (ISO week number; see the year quirk below)
 *   monthly -> 'YYYY-MM'
 *
 * Everything here is pure, timezone independent (UTC maths) and never throws:
 * unparseable input yields `null` / the PLACEHOLDER label.
 */

export type PeriodKind = 'day' | 'week' | 'month';

export interface ParsedPeriod {
  kind: PeriodKind;
  /** First day of the period at 00:00 UTC (Monday for weeks). */
  start: Date;
}

export const PERIOD_PLACEHOLDER = '—';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_MS = 86_400_000;

const WEEK_RE = /^(\d{4})-W(\d{2})$/;
const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/;
const MONTH_RE = /^(\d{4})-(\d{2})$/;

/** ISO weekday of a UTC date: Monday=1 ... Sunday=7. */
function isoWeekday(date: Date): number {
  return date.getUTCDay() || 7;
}

/** Monday 00:00 UTC of ISO week 1 of `year` (the week containing Jan 4th). */
function isoWeekOneMonday(year: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  return new Date(jan4.getTime() - (isoWeekday(jan4) - 1) * DAY_MS);
}

/** ISO years have 53 weeks when Jan 1 is a Thursday, or a leap year Wednesday. */
function hasWeek53(year: number): boolean {
  const jan1 = new Date(Date.UTC(year, 0, 1)).getUTCDay();
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return jan1 === 4 || (leap && jan1 === 3);
}

function buildUtcDate(year: number, month: number, day: number): Date | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  const valid =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return valid ? date : null;
}

function parseWeek(year: number, week: number): Date | null {
  if (week < 1 || week > 53) return null;
  let isoYear = year;
  if (week === 53 && !hasWeek53(year)) {
    // The backend labels dates with the calendar year but the ISO week number,
    // so 1-3 Jan can come out as e.g. '2027-W53' (really 2026-W53).
    if (!hasWeek53(year - 1)) return null;
    isoYear = year - 1;
  }
  return new Date(isoWeekOneMonday(isoYear).getTime() + (week - 1) * 7 * DAY_MS);
}

export function parsePeriodKey(key: unknown): ParsedPeriod | null {
  if (typeof key !== 'string') return null;
  const value = key.trim();

  const week = WEEK_RE.exec(value);
  if (week) {
    const start = parseWeek(Number(week[1]), Number(week[2]));
    return start ? { kind: 'week', start } : null;
  }

  const day = DAY_RE.exec(value);
  if (day) {
    const start = buildUtcDate(Number(day[1]), Number(day[2]), Number(day[3]));
    return start ? { kind: 'day', start } : null;
  }

  const month = MONTH_RE.exec(value);
  if (month) {
    const start = buildUtcDate(Number(month[1]), Number(month[2]), 1);
    return start ? { kind: 'month', start } : null;
  }

  return null;
}

function monthDay(date: Date): string {
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

/** Short axis label: 'Aug 17' (day/week start) or 'Aug 2026' (month). */
export function formatPeriodLabel(key: unknown): string {
  const parsed = parsePeriodKey(key);
  if (!parsed) return PERIOD_PLACEHOLDER;
  if (parsed.kind === 'month') {
    return `${MONTHS[parsed.start.getUTCMonth()]} ${parsed.start.getUTCFullYear()}`;
  }
  return monthDay(parsed.start);
}

/** Tooltip/long label: weeks render as 'Aug 17 - 23' or 'Aug 31 - Sep 6'. */
export function formatPeriodRangeLabel(key: unknown): string {
  const parsed = parsePeriodKey(key);
  if (!parsed || parsed.kind !== 'week') return formatPeriodLabel(key);
  const end = new Date(parsed.start.getTime() + 6 * DAY_MS);
  const sameMonth = end.getUTCMonth() === parsed.start.getUTCMonth();
  const endLabel = sameMonth ? String(end.getUTCDate()) : monthDay(end);
  return `${monthDay(parsed.start)} - ${endLabel}`;
}
