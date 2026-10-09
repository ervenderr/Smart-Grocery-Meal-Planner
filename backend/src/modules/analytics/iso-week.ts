const MS_PER_DAY = 86_400_000;
const DAYS_PER_WEEK = 7;
const ISO_THURSDAY = 4;
const SUNDAY_AS_ISO_DAY = 7;

const pad2 = (n: number): string => String(n).padStart(2, '0');

/**
 * ISO 8601 week key (YYYY-Www) using the ISO week-year and UTC getters only.
 */
export function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || SUNDAY_AS_ISO_DAY;
  // Shift to the Thursday of this ISO week; its year is the ISO week-year.
  d.setUTCDate(d.getUTCDate() + ISO_THURSDAY - dayNum);
  const weekYear = d.getUTCFullYear();
  const yearStart = Date.UTC(weekYear, 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / MS_PER_DAY + 1) / DAYS_PER_WEEK);
  return `${weekYear}-W${pad2(week)}`;
}

/**
 * Period key for grouping: daily YYYY-MM-DD, weekly ISO week, otherwise YYYY-MM (all UTC).
 */
export function periodKey(date: Date, period: string): string {
  if (period === 'daily') {
    return date.toISOString().split('T')[0];
  }
  if (period === 'weekly') {
    return isoWeekKey(date);
  }
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}`;
}
