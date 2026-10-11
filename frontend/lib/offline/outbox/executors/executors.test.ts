import { describe, expect, it } from 'vitest';
import type { Transport, TransportRequest } from '../../transport';
import type { OutboxStore } from '../store';
import type { NewOp } from '../op-types';
import { ID_A, makeOp } from '../fixtures.test-helper';
import { createExecutorRegistry } from './index';
import type { Executor } from './types';

function recorder(result: unknown = { ok: true }) {
  const sent: TransportRequest[] = [];
  const transport: Transport = {
    async send<T>(req: TransportRequest) {
      sent.push(req);
      return result as T;
    },
  };
  return { sent, ctx: { transport, store: {} as OutboxStore } };
}

async function runOp(op: NewOp) {
  const rec = recorder({ id: 'srv' });
  const registry = createExecutorRegistry();
  const exec = registry.get(op.kind);
  const full = makeOp(op);
  const result = await exec!.run(full, rec.ctx);
  return { req: rec.sent[0], result, key: full.idempotencyKey, count: rec.sent.length };
}

const item = { id: ID_A, itemName: 'Milk', quantity: 2 };
const pantryItem = { id: ID_A, ingredientName: 'Rice', category: 'grains' as const, quantity: 1, unit: 'kg' as const };

describe('executors', () => {
  it('shopping.item.create posts the item with client id', async () => {
    const { req, key, result } = await runOp({ kind: 'shopping.item.create', label: 'Milk', payload: { item } });
    expect(req).toMatchObject({ method: 'POST', url: '/api/v1/shopping/items', body: item, idempotencyKey: key });
    expect(result).toEqual({ id: 'srv' });
  });
  it('shopping.item.update patches by id', async () => {
    const { req, key } = await runOp({ kind: 'shopping.item.update', label: 'Milk', payload: { id: ID_A, patch: { quantity: 3 } } });
    expect(req).toMatchObject({ method: 'PATCH', url: `/api/v1/shopping/items/${ID_A}`, body: { quantity: 3 }, idempotencyKey: key });
  });
  it('shopping.item.delete deletes by id', async () => {
    const { req, key } = await runOp({ kind: 'shopping.item.delete', label: 'Milk', payload: { id: ID_A } });
    expect(req).toMatchObject({ method: 'DELETE', url: `/api/v1/shopping/items/${ID_A}`, idempotencyKey: key });
    expect(req.body).toBeUndefined();
  });
  it('pantry.create posts the item', async () => {
    const { req, key } = await runOp({ kind: 'pantry.create', label: 'Rice', payload: { item: pantryItem } });
    expect(req).toMatchObject({ method: 'POST', url: '/api/v1/pantry', body: pantryItem, idempotencyKey: key });
  });
  it('pantry.adjust sends { delta }', async () => {
    const { req, key } = await runOp({ kind: 'pantry.adjust', label: 'Rice', payload: { id: ID_A, delta: 2.5 } });
    expect(req).toMatchObject({ method: 'POST', url: `/api/v1/pantry/${ID_A}/adjust`, body: { delta: 2.5 }, idempotencyKey: key });
  });
  it('pantry.update patches by id', async () => {
    const { req } = await runOp({ kind: 'pantry.update', label: 'Rice', payload: { id: ID_A, patch: { notes: 'x' } } });
    expect(req).toMatchObject({ method: 'PATCH', url: `/api/v1/pantry/${ID_A}`, body: { notes: 'x' } });
  });
  it('pantry.delete deletes by id', async () => {
    const { req, count } = await runOp({ kind: 'pantry.delete', label: 'Rice', payload: { id: ID_A } });
    expect(req).toMatchObject({ method: 'DELETE', url: `/api/v1/pantry/${ID_A}` });
    expect(count).toBe(1);
  });
});

describe('registry', () => {
  it('returns null for unknown kinds and honors extras', () => {
    expect(createExecutorRegistry().get('cook.apply')).not.toBeNull();
    expect(createExecutorRegistry().get('bogus' as never)).toBeNull();
    const extra: Executor = { run: async () => 1 };
    expect(createExecutorRegistry({ 'cook.apply': extra }).get('cook.apply')).toBe(extra);
  });
});
