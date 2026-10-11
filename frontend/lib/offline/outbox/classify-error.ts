import type { LastError, OpKind } from './op-types';

export const MAX_TRANSIENT_ATTEMPTS = 8;

export type TransportFailure = {
  network: boolean;
  timeout: boolean;
  status?: number;
  code?: string;
  retryAfterMs?: number;
  /** UPGRADE_REQUIRED details.limit, kept on the parked op for its reason copy. */
  limit?: number;
};

export type Outcome =
  | { kind: 'ok' }
  | { kind: 'retry'; countsAttempt: boolean; retryAfterMs?: number }
  | { kind: 'pause-auth' }
  | { kind: 'park'; error: LastError };

const IN_FLIGHT = 'IDEMPOTENCY_IN_FLIGHT';
const UPGRADE_REQUIRED = 'UPGRADE_REQUIRED';
const DELETE_KINDS: readonly OpKind[] = ['shopping.item.delete', 'pantry.delete'];

function park(reason: LastError['reason'], f: TransportFailure): Outcome {
  const error: LastError = { reason };
  if (f.status !== undefined) error.status = f.status;
  if (f.code !== undefined) error.code = f.code;
  if (f.limit !== undefined) error.limit = f.limit;
  return { kind: 'park', error };
}

function transient(f: TransportFailure, attempts: number): Outcome {
  if (attempts + 1 >= MAX_TRANSIENT_ATTEMPTS) {
    return { kind: 'park', error: { reason: 'max-attempts', ...(f.status !== undefined ? { status: f.status } : {}) } };
  }
  const out: Outcome = { kind: 'retry', countsAttempt: true };
  if (f.retryAfterMs !== undefined) out.retryAfterMs = f.retryAfterMs;
  return out;
}

export interface ClassifyContext {
  kind: OpKind;
  attempts: number;
  /** True when the user who owns the op is still signed in after the request failed. */
  sessionActive?: boolean;
}

export function classify(f: TransportFailure, ctx: ClassifyContext): Outcome {
  if (f.network || f.timeout) return { kind: 'retry', countsAttempt: false };
  const s = f.status;
  // A 401 that survived the refresh attempt while still signed in means the refresh failed
  // transiently (SYNC-07 keeps the session): retry with backoff. Pause only once the session ended.
  if (s === 401) return ctx.sessionActive ? transient(f, ctx.attempts) : { kind: 'pause-auth' };
  if (s === 409 && f.code === IN_FLIGHT) {
    return { kind: 'retry', countsAttempt: false, ...(f.retryAfterMs !== undefined ? { retryAfterMs: f.retryAfterMs } : {}) };
  }
  if (s === 409) return park('conflict', f);
  if (s === 404) return DELETE_KINDS.includes(ctx.kind) ? { kind: 'ok' } : park('gone', f);
  if (s === 410) return park('gone', f);
  if (s === 429 || (s !== undefined && s >= 500) || s === undefined) return transient(f, ctx.attempts);
  // Free-tier limit hit on replay: keep the op retryable (it succeeds after unlock or freeing a spot).
  if (s === 403 && f.code === UPGRADE_REQUIRED) return park('conflict', f);
  return park('invalid', f);
}
