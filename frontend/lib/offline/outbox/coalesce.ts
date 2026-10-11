import type { NewOp, OutboxOp } from './op-types';

type Payload = NewOp['payload'];

export type EnqueuePlan =
  | { type: 'insert' }
  | { type: 'merge'; seq: number; payload: Payload; inverse: unknown }
  | { type: 'drop'; seqs: number[]; insert: boolean };

const INSERT: EnqueuePlan = { type: 'insert' };

/** True only if the op has never been handed to the network (payload still mutable). */
export function isUnattempted(op: OutboxOp): boolean {
  return op.state === 'queued' && op.attempts === 0 && op.lastError === null;
}

const addCents = (a: number, b: number): number => Math.round(a * 100 + b * 100) / 100;

function previousOf(inverse: unknown): Record<string, unknown> {
  if (typeof inverse === 'object' && inverse !== null && 'previous' in inverse) {
    const prev = (inverse as { previous: unknown }).previous;
    if (typeof prev === 'object' && prev !== null) return prev as Record<string, unknown>;
  }
  return {};
}

/** Earlier values win for fields already present; new fields come from the incoming op. */
function mergeInverse(earlier: unknown, incoming: unknown): unknown {
  return { previous: { ...previousOf(incoming), ...previousOf(earlier) } };
}

function lastOf(ops: readonly OutboxOp[], kinds: readonly string[]): OutboxOp | undefined {
  return [...ops].reverse().find((o) => kinds.includes(o.kind));
}

function planUpdate(eligible: readonly OutboxOp[], incoming: NewOp & { payload: { patch: object } }): EnqueuePlan {
  const createKind = incoming.kind === 'pantry.update' ? 'pantry.create' : 'shopping.item.create';
  const patch = incoming.payload.patch;
  const create = lastOf(eligible, [createKind]);
  if (create) {
    const item = (create.payload as { item: object }).item;
    return { type: 'merge', seq: create.seq, payload: { item: { ...item, ...patch } } as Payload, inverse: create.inverse };
  }
  const prior = lastOf(eligible, [incoming.kind]);
  if (!prior) return INSERT;
  const priorPayload = prior.payload as { id: string; patch: object };
  return {
    type: 'merge',
    seq: prior.seq,
    payload: { id: priorPayload.id, patch: { ...priorPayload.patch, ...patch } } as Payload,
    inverse: mergeInverse(prior.inverse, incoming.inverse),
  };
}

function planAdjust(eligible: readonly OutboxOp[], incoming: Extract<NewOp, { kind: 'pantry.adjust' }>): EnqueuePlan {
  const prior = lastOf(eligible, ['pantry.adjust']);
  if (!prior) return INSERT;
  const sum = addCents((prior.payload as { delta: number }).delta, incoming.payload.delta);
  if (sum === 0) return { type: 'drop', seqs: [prior.seq], insert: false };
  return { type: 'merge', seq: prior.seq, payload: { id: incoming.payload.id, delta: sum }, inverse: null };
}

function planDelete(eligible: readonly OutboxOp[]): EnqueuePlan {
  const seqs = eligible.map((o) => o.seq);
  const hasCreate = eligible.some((o) => o.kind === 'pantry.create' || o.kind === 'shopping.item.create');
  if (seqs.length === 0) return INSERT;
  return { type: 'drop', seqs, insert: !hasCreate };
}

/** Decide how an incoming op combines with pending ops of the same entity (ordered by seq). */
export function planEnqueue(pending: readonly OutboxOp[], incoming: NewOp): EnqueuePlan {
  const eligible = pending.filter(isUnattempted);
  switch (incoming.kind) {
    case 'shopping.item.update':
    case 'pantry.update':
      return planUpdate(eligible, incoming);
    case 'pantry.adjust':
      return planAdjust(eligible, incoming);
    case 'shopping.item.delete':
    case 'pantry.delete':
      return planDelete(eligible);
    default:
      return INSERT;
  }
}
