/**
 * Sliding-window limiter for outbound calls. Pure: the clock is injectable and
 * the timestamp window is replaced (never mutated) on every call.
 */

export type ThrottleDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly retryAfterSeconds: number };

export interface OutboundThrottle {
  tryAcquire(): ThrottleDecision;
}

export interface ThrottleOptions {
  readonly limit: number;
  readonly windowMs: number;
  readonly now?: () => number;
}

export function createOutboundThrottle(options: ThrottleOptions): OutboundThrottle {
  const { limit, windowMs, now = Date.now } = options;
  let stamps: readonly number[] = [];

  return {
    tryAcquire(): ThrottleDecision {
      const current = now();
      const live = stamps.filter((t) => current - t < windowMs);
      if (live.length >= limit) {
        stamps = live;
        const retryMs = live[0] + windowMs - current;
        return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(retryMs / 1000)) };
      }
      stamps = [...live, current];
      return { allowed: true };
    },
  };
}

/** OFF allows 15 product reads/min per IP; stay under it. */
export const OFF_THROTTLE_LIMIT = 12;
export const OFF_THROTTLE_WINDOW_MS = 60_000;
/** USDA allows 1,000 req/hour per key; stay under it. */
export const USDA_THROTTLE_LIMIT = 600;
export const USDA_THROTTLE_WINDOW_MS = 3_600_000;
