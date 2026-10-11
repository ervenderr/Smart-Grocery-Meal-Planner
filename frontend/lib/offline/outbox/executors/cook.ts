import { API_ROUTES } from '@/lib/constants/api-routes';
import { toDeductions } from '@/lib/cook/preview';
import type { CookPreview, CookRow } from '@/types/cook.types';
import type { TransportFailure } from '../classify-error';
import type { NewOp } from '../op-types';
import type { Executor } from './types';

type CookPayload = Extract<NewOp, { kind: 'cook.apply' }>['payload'];

/** Mirrors the sheet's default editable rows: mismatch rows are excluded until unlocked by the user. */
export function defaultRows(rows: readonly CookRow[]): CookRow[] {
  return rows.filter((r) => r.status !== 'mismatch');
}

const alreadyCooked = (): TransportFailure => ({ network: false, timeout: false, status: 409, code: 'ALREADY_COOKED' });

/**
 * Two-phase: resolve the deduction plan against live pantry lots, freeze it on the
 * op row, then apply. A retry reuses the frozen body so the idempotent replay matches.
 */
export const cookApplyExecutor: Executor = {
  async run(op, { transport, store }) {
    const { target, servings, occurredAt } = op.payload as CookPayload;
    let body = op.resolved;
    if (body === null || body === undefined) {
      const preview = await transport.send<CookPreview>({
        method: 'POST',
        url: API_ROUTES.COOK.PREVIEW,
        body: { ...target, servings },
        idempotencyKey: `${op.idempotencyKey}.preview`,
      });
      if (preview.alreadyCooked) throw alreadyCooked();
      body = { ...target, deductions: toDeductions(defaultRows(preview.rows), {}), occurredAt };
      await store.saveResolved(op.seq, body);
    }
    return transport.send({
      method: 'POST',
      url: API_ROUTES.COOK.APPLY,
      body,
      idempotencyKey: op.idempotencyKey,
    });
  },
};
