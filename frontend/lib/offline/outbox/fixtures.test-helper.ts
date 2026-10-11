// Tests only.
import type { NewOp, OutboxOp } from './op-types';
import { entityOf } from './op-types';

export const ID_A = '3f2b8a52-8c1e-4c6e-9a53-1f0e5d3b7a10';
export const ID_B = '4f2b8a52-8c1e-4c6e-9a53-1f0e5d3b7a11';

let counter = 0;

export function makeOp(op: NewOp, over: Partial<OutboxOp> = {}): OutboxOp {
  counter += 1;
  const { entityType, entityId } = entityOf(op);
  return {
    seq: counter,
    opId: `op-${counter}`,
    idempotencyKey: `key-${counter}`,
    userId: 'u1',
    kind: op.kind,
    entityType,
    entityId,
    payload: op.payload,
    inverse: op.inverse ?? null,
    resolved: null,
    label: op.label,
    state: 'queued',
    attempts: 0,
    lastError: null,
    nextAttemptAt: 0,
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    ...over,
  };
}
