import type { NewOp, OutboxOp } from './outbox/op-types';
import { getOfflineRuntime, type OfflineRuntime } from './runtime';

export type WriteOutcome<T> = { mode: 'queued'; op: OutboxOp | null } | { mode: 'direct'; result: T };

/**
 * One write path: through the outbox when the offline runtime exists (native),
 * otherwise the legacy direct API call (web, D-08). `op` is only evaluated when queueing.
 */
export async function offlineWrite<T>(
  { op, direct }: { op: () => NewOp; direct: () => Promise<T> },
  runtime: Pick<OfflineRuntime, 'enqueue'> | null = getOfflineRuntime(),
): Promise<WriteOutcome<T>> {
  if (runtime) return { mode: 'queued', op: await runtime.enqueue(op()) };
  return { mode: 'direct', result: await direct() };
}
