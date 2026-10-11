import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migrate } from '../../sql/migrations';
import { createNodeSqlDb } from '../../sql/node-sqldb.test-helper';
import type { Transport, TransportRequest } from '../../transport';
import type { TransportFailure } from '../classify-error';
import { buildCookApply } from '../../ops/cook-ops';
import { buildShoppingFinish } from '../../ops/finish-ops';
import { ID_A, ID_B } from '../fixtures.test-helper';
import { createOutboxStore, type OutboxStore } from '../store';
import { cookApplyExecutor, defaultRows } from './cook';
import { createExecutorRegistry } from './index';
import { shoppingFinishExecutor } from './shopping-finish';

const U = 'u1';
const NOW = new Date('2026-10-11T10:00:00.000Z');
const row = (key: string, use: number, status: 'ok' | 'short' | 'mismatch' = 'ok') =>
  ({ key, name: key, unit: 'g', have: 100, use, left: 100 - use, status }) as const;

/** Fake server mirroring the idempotency middleware for cook and finish routes. */
function fakeServer(preview: Record<string, unknown>) {
  const stored = new Map<string, { hash: string; response: unknown }>();
  const applies = new Map<string, number>();
  const calls: TransportRequest[] = [];
  let dropNext = false;
  let failNext: Partial<TransportFailure> | null = null;
  const transport: Transport = {
    async send<T>(req: TransportRequest): Promise<T> {
      calls.push(req);
      if (failNext) {
        const f = failNext;
        failNext = null;
        throw { network: false, timeout: false, ...f };
      }
      const hash = JSON.stringify([req.url, req.body]);
      const prior = stored.get(req.idempotencyKey);
      if (prior) {
        if (prior.hash !== hash) throw { network: false, timeout: false, status: 422, code: 'IDEMPOTENCY_KEY_REUSED' };
        if (dropNext) {
          dropNext = false;
          throw { network: true, timeout: false };
        }
        return prior.response as T;
      }
      const response = req.url.endsWith('/cook/preview') ? preview : req.url.endsWith('/cook/apply') ? { updated: 1, usedUp: 0 } : { list: { id: 'L2', items: [] } };
      stored.set(req.idempotencyKey, { hash, response });
      applies.set(req.idempotencyKey, 1);
      if (dropNext && !req.url.endsWith('/cook/preview')) {
        dropNext = false;
        throw { network: true, timeout: false };
      }
      return response as T;
    },
  };
  return {
    transport,
    calls,
    applyCount: (k: string) => applies.get(k) ?? 0,
    dropAfterCommit: () => void (dropNext = true),
    failWith: (f: Partial<TransportFailure>) => void (failNext = f),
  };
}

const basePreview = { alreadyCooked: false, rows: [row('rice', 50), row('salt', 0), row('egg', 2, 'mismatch'), row('oil', 10, 'short')] };
let store: OutboxStore;
const closers: Array<{ close(): void }> = [];

beforeEach(async () => {
  const db = createNodeSqlDb(':memory:');
  closers.push(db);
  await migrate(db);
  store = createOutboxStore({ db, now: () => 1000 });
});
afterEach(() => closers.splice(0).forEach((c) => c.close()));

const enqueueCook = async () =>
  (await store.enqueue(U, buildCookApply({ target: { mealPlanItemId: ID_A }, servings: 2, title: 'Adobo', previousCookedAt: null, now: NOW })))!;

describe('defaultRows', () => {
  it('excludes mismatch rows only', () => {
    expect(defaultRows(basePreview.rows).map((r) => r.key)).toEqual(['rice', 'salt', 'oil']);
  });
});

describe('cookApplyExecutor', () => {
  it('previews with a derived key, saves the resolved body, then applies with the op key', async () => {
    const srv = fakeServer(basePreview);
    const op = await enqueueCook();
    await cookApplyExecutor.run(op, { transport: srv.transport, store });
    expect(srv.calls[0].idempotencyKey).toBe(`${op.idempotencyKey}.preview`);
    expect(srv.calls[1].idempotencyKey).toBe(op.idempotencyKey);
    const expected = {
      mealPlanItemId: ID_A,
      deductions: [{ key: 'rice', unit: 'g', use: 50 }, { key: 'oil', unit: 'g', use: 10 }],
      occurredAt: NOW.toISOString(),
    };
    expect(srv.calls[1].body).toEqual(expected);
    expect((await store.list(U))[0].resolved).toEqual(expected);
  });

  it('retry after a lost apply response skips preview and applies exactly once', async () => {
    const srv = fakeServer(basePreview);
    const op = await enqueueCook();
    srv.dropAfterCommit();
    await expect(cookApplyExecutor.run(op, { transport: srv.transport, store })).rejects.toMatchObject({ network: true });
    const reread = (await store.list(U))[0];
    expect(reread.resolved).not.toBeNull();
    const before = srv.calls.length;
    await cookApplyExecutor.run(reread, { transport: srv.transport, store });
    expect(srv.calls.slice(before).map((c) => c.url.endsWith('/cook/apply'))).toEqual([true]);
    expect(srv.applyCount(op.idempotencyKey)).toBe(1);
  });

  it('rejects ALREADY_COOKED when the preview says the meal is cooked, without saving a body', async () => {
    const srv = fakeServer({ ...basePreview, alreadyCooked: true });
    const op = await enqueueCook();
    await expect(cookApplyExecutor.run(op, { transport: srv.transport, store })).rejects.toMatchObject({ status: 409, code: 'ALREADY_COOKED' });
    expect((await store.list(U))[0].resolved).toBeNull();
    expect(srv.calls).toHaveLength(1);
  });

  it('propagates apply 409 ALREADY_COOKED', async () => {
    const srv = fakeServer(basePreview);
    const op = await enqueueCook();
    await cookApplyExecutor.run({ ...op, resolved: { mealPlanItemId: ID_A, deductions: [], occurredAt: 'x' } }, { transport: fakeServer(basePreview).transport, store });
    const srv2 = fakeServer(basePreview);
    srv2.failWith({ status: 409, code: 'ALREADY_COOKED' });
    await expect(
      cookApplyExecutor.run({ ...op, resolved: { mealPlanItemId: ID_A, deductions: [], occurredAt: 'x' } }, { transport: srv2.transport, store }),
    ).rejects.toMatchObject({ status: 409, code: 'ALREADY_COOKED' });
    expect(srv.calls).toHaveLength(0);
  });

  it('applies a recipe target with servings in the preview', async () => {
    const srv = fakeServer(basePreview);
    const op = (await store.enqueue(U, buildCookApply({ target: { recipeId: ID_B }, servings: 3, title: 'Soup', previousCookedAt: null, now: NOW })))!;
    await cookApplyExecutor.run(op, { transport: srv.transport, store });
    expect(srv.calls[0].body).toEqual({ recipeId: ID_B, servings: 3 });
  });
});

describe('shoppingFinishExecutor', () => {
  it('posts the finish input with occurredAt and receiptDate', async () => {
    const srv = fakeServer(basePreview);
    const op = (await store.enqueue(U, buildShoppingFinish({ input: { carryOver: 'carry' }, now: NOW })))!;
    const result = await shoppingFinishExecutor.run(op, { transport: srv.transport, store });
    expect(srv.calls[0]).toMatchObject({ method: 'POST', idempotencyKey: op.idempotencyKey });
    expect(srv.calls[0].url.endsWith('/shopping/finish')).toBe(true);
    expect(srv.calls[0].body).toMatchObject({ carryOver: 'carry', occurredAt: NOW.toISOString(), receiptDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
    expect(result).toEqual({ list: { id: 'L2', items: [] } });
  });

  it('is not ready while an earlier shopping item op is queued, ready after it completes', async () => {
    const upd = (await store.enqueue(U, { kind: 'shopping.item.update', label: 'Eggs', payload: { id: ID_B, patch: { isChecked: true } } }))!;
    await store.enqueue(U, buildShoppingFinish({ input: {}, now: NOW }));
    const first = await store.nextReady(U, 5000);
    expect(first?.seq).toBe(upd.seq);
    await store.markInFlight(upd.seq);
    expect(await store.nextReady(U, 5000)).toBeNull();
    await store.complete(upd.seq);
    expect((await store.nextReady(U, 5000))?.kind).toBe('shopping.finish');
  });
});

describe('default registry', () => {
  it('registers cook.apply and shopping.finish', () => {
    const reg = createExecutorRegistry();
    expect(reg.get('cook.apply')).toBe(cookApplyExecutor);
    expect(reg.get('shopping.finish')).toBe(shoppingFinishExecutor);
  });
});
