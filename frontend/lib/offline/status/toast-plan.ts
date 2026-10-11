import type { DrainEvent } from '../outbox/drain';
import type { OutboxOp } from '../outbox/op-types';

export interface PlannedToast {
  kind: 'success' | 'attention' | 'info';
  message: string;
}

const changes = (n: number): string => `${n} ${n === 1 ? 'change' : 'changes'}`;

function serverQuantity(result: unknown, id: string): number | null {
  if (!result || typeof result !== 'object') return null;
  const r = result as Record<string, unknown>;
  const row = [r, r.item, r.data].find(
    (c): c is Record<string, unknown> => !!c && typeof c === 'object' && (c as { id?: unknown }).id === id,
  );
  if (!row) return null;
  const q = Number(row.quantity);
  return Number.isFinite(q) ? q : null;
}

function isUsedUp(op: OutboxOp, result: unknown): boolean {
  if (op.kind !== 'pantry.adjust') return false;
  const { delta } = op.payload as { delta: number };
  return delta < 0 && serverQuantity(result, op.entityId) === 0;
}

function lateSuccess(op: OutboxOp): string | null {
  if (op.kind === 'cook.apply') return `Synced: marked "${op.label}" as cooked.`;
  if (op.kind === 'shopping.finish') return 'Synced: your shopping trip was recorded.';
  return null;
}

/** Aggregates the events of one drain run into at most one success, one attention and used-up infos. */
export function planDrainToasts(events: readonly DrainEvent[]): ReadonlyArray<PlannedToast> {
  const applied = events.flatMap((e) => (e.type === 'applied' ? [e] : []));
  const parked = events.filter((e) => e.type === 'parked').length;
  const toasts: PlannedToast[] = [];

  if (applied.length === 1) {
    const late = lateSuccess(applied[0].op);
    toasts.push({ kind: 'success', message: late ?? '1 change synced' });
  } else if (applied.length > 1) {
    toasts.push({ kind: 'success', message: `${applied.length} changes synced` });
  }
  for (const e of applied) {
    if (isUsedUp(e.op, e.result)) {
      toasts.push({ kind: 'info', message: `${e.op.label} was used up. Quantity set to 0.` });
    }
  }
  if (parked > 0) toasts.push({ kind: 'attention', message: `${changes(parked)} ${parked === 1 ? 'needs' : 'need'} attention` });
  return toasts;
}
