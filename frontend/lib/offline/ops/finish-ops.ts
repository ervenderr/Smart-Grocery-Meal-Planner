import type { FinishShoppingInput } from '@/types/shopping.types';
import type { NewOp, OutboxOp } from '../outbox/op-types';

const PENDING_STATES: ReadonlySet<string> = new Set(['queued', 'in_flight', 'paused_auth']);

export function localIsoDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function buildShoppingFinish({ input, now }: { input: FinishShoppingInput; now: Date }): NewOp {
  return {
    kind: 'shopping.finish',
    label: 'Finish trip',
    payload: {
      input: { ...input, occurredAt: now.toISOString(), receiptDate: input.receiptDate ?? localIsoDate(now) },
    },
    inverse: {},
  };
}

/** The active list is locked for edits while a finish is still waiting to sync. */
export function isFinishPending(ops: readonly OutboxOp[]): boolean {
  return ops.some((op) => op.kind === 'shopping.finish' && PENDING_STATES.has(op.state));
}
