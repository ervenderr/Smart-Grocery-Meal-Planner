export const BACKOFF_BASE_MS = 1000;
export const BACKOFF_MAX_MS = 30000;
const JITTER = 0.2;

export function nextDelayMs(
  attempts: number,
  opts: { random?: () => number; retryAfterMs?: number } = {}
): number {
  const random = opts.random ?? Math.random;
  const exp = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** Math.max(0, attempts));
  const jittered = Math.round(exp * (1 + (random() * 2 - 1) * JITTER));
  return Math.max(jittered, opts.retryAfterMs ?? 0);
}
