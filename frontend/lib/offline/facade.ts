import type { NewOp, OutboxOp } from './outbox/op-types';
import { BOOT_TIMEOUT_MS } from './boot';
import { isOfflineEnabled } from './enabled';
import { getOfflineRuntime, whenOfflineRuntime, type OfflineRuntime } from './runtime';

type EnqueueRuntime = Pick<OfflineRuntime, 'enqueue'>;

/**
 * Current runtime; on native builds waits (bounded by the boot timeout) for a boot still in progress,
 * so an early write is queued rather than sent directly while offline. Web returns null at once.
 */
async function resolveRuntime(): Promise<OfflineRuntime | null> {
  const ready = getOfflineRuntime();
  if (ready || !isOfflineEnabled()) return ready;
  return new Promise<OfflineRuntime | null>((resolve) => {
    let stop: () => void = () => undefined;
    const timer = setTimeout(() => {
      stop();
      resolve(null);
    }, BOOT_TIMEOUT_MS);
    stop = whenOfflineRuntime((runtime) => {
      clearTimeout(timer);
      resolve(runtime);
    });
  });
}

export type WriteOutcome<T> = { mode: 'queued'; op: OutboxOp | null } | { mode: 'direct'; result: T };

/**
 * One write path: through the outbox when the offline runtime exists (native),
 * otherwise the legacy direct API call (web, D-08). `op` is only evaluated when queueing.
 */
export async function offlineWrite<T>(
  { op, direct }: { op: () => NewOp; direct: () => Promise<T> },
  runtime?: EnqueueRuntime | null,
): Promise<WriteOutcome<T>> {
  const rt = runtime === undefined ? await resolveRuntime() : runtime;
  if (rt) return { mode: 'queued', op: await rt.enqueue(op()) };
  return { mode: 'direct', result: await direct() };
}

/** Like offlineWrite for edits that need several ordered ops (e.g. a field update plus a quantity delta). */
export async function offlineWriteMany<T>(
  { ops, direct }: { ops: () => NewOp[]; direct: () => Promise<T> },
  runtime?: EnqueueRuntime | null,
): Promise<WriteOutcome<T>> {
  const rt = runtime === undefined ? await resolveRuntime() : runtime;
  if (!rt) return { mode: 'direct', result: await direct() };
  let last: OutboxOp | null = null;
  for (const op of ops()) last = await rt.enqueue(op);
  return { mode: 'queued', op: last };
}
