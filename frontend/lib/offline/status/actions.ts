import type { OutboxOp } from '../outbox/op-types';
import { canRetry } from './describe-op';
import { rollbackOp } from '../reconcile/rollback';
import type { OfflineRuntime } from '../runtime';

type ActionRuntime = Pick<OfflineRuntime, 'store' | 'drain' | 'applyWrites'>;


function rollBackAll(runtime: ActionRuntime, ops: readonly OutboxOp[]): number {
  for (const op of [...ops].reverse()) runtime.applyWrites(rollbackOp(op).writes);
  return ops.length;
}

export async function retryOp(runtime: ActionRuntime, seq: number): Promise<void> {
  await runtime.store.retry(seq);
  runtime.drain.kick('retry');
}

/** Discards a failed op plus its blocked dependents and undoes the optimistic change. */
export async function discardOp(runtime: ActionRuntime, seq: number): Promise<number> {
  return rollBackAll(runtime, await runtime.store.discard(seq));
}

/** Retries every retryable failed op, then kicks the drain (which also picks up ops waiting in backoff). */
export async function retryAll(runtime: ActionRuntime, userId: string): Promise<number> {
  const ops = await runtime.store.list(userId);
  const retryable = ops.filter(canRetry);
  for (const op of retryable) await runtime.store.retry(op.seq);
  runtime.drain.kick('retry');
  return retryable.length;
}

export async function discardAllFailed(runtime: ActionRuntime, userId: string): Promise<number> {
  return rollBackAll(runtime, await runtime.store.discardAllFailed(userId));
}
