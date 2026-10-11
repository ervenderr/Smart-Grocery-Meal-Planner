import { isOfflineError } from '@/lib/api/offline-error';
import { newId } from './ids';

const TIMEOUT_CODES: ReadonlySet<string> = new Set(['ECONNABORTED', 'ETIMEDOUT']);

/** True when the request may not have reached the server (offline, no response, timeout). */
export function isQueueableFailure(error: unknown): boolean {
  if (isOfflineError(error)) return true;
  if (typeof error !== 'object' || error === null) return false;
  const e = error as { code?: unknown; request?: unknown; response?: unknown };
  if (typeof e.code === 'string' && TIMEOUT_CODES.has(e.code)) return true;
  return e.request !== undefined && e.response === undefined;
}

export type DirectOrQueued<T> = { mode: 'direct'; result: T } | { mode: 'queued' };

/**
 * Sends with an idempotency key; on a network failure queues the same body under the
 * SAME key so the server applies it exactly once. Other errors rethrow.
 */
export async function directThenQueue<T>({
  send,
  queue,
  newKey = newId,
}: {
  send: (idempotencyKey: string) => Promise<T>;
  queue: (idempotencyKey: string) => Promise<void>;
  newKey?: () => string;
}): Promise<DirectOrQueued<T>> {
  const key = newKey();
  try {
    return { mode: 'direct', result: await send(key) };
  } catch (error) {
    if (!isQueueableFailure(error)) throw error;
    await queue(key);
    return { mode: 'queued' };
  }
}
