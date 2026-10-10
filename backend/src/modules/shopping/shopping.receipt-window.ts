/**
 * Receipt-date window and occurredAt clamp for finishing a trip recorded offline.
 */

export const RECEIPT_WINDOW_PAST_DAYS = 14;
export const RECEIPT_WINDOW_FUTURE_DAYS = 1;
export const OCCURRED_AT_MAX_AGE_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

const utcMidnightMs = (d: Date): number =>
  Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

/** UTC midnight of the given instant, as a new Date. */
export const utcDateOf = (d: Date): Date => new Date(utcMidnightMs(d));

/** True for a real YYYY-MM-DD within UTC today -14 days .. +1 day. */
export const withinReceiptWindow = (value: string, now: Date = new Date()): boolean => {
  const ms = Date.parse(`${value}T00:00:00.000Z`);
  if (Number.isNaN(ms)) return false;
  if (new Date(ms).toISOString().slice(0, 10) !== value) return false;
  const today = utcMidnightMs(now);
  return (
    ms >= today - RECEIPT_WINDOW_PAST_DAYS * DAY_MS &&
    ms <= today + RECEIPT_WINDOW_FUTURE_DAYS * DAY_MS
  );
};

/** Bounds a client timestamp to [now - 14d, now]; missing or invalid means now. */
export const clampOccurredAt = (value: string | undefined, now: Date = new Date()): Date => {
  const nowMs = now.getTime();
  if (value === undefined) return new Date(nowMs);
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return new Date(nowMs);
  const floor = nowMs - OCCURRED_AT_MAX_AGE_DAYS * DAY_MS;
  return new Date(Math.min(Math.max(ms, floor), nowMs));
};
