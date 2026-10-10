/**
 * POST /pantry/:id/adjust (08-09, SYNC-02): delta math under the pantry lock.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database.config';
import * as lowStock from '../src/modules/pantry/pantry.low-stock';

const app = createApp();
const PREFIX = 'pantry-adjust';

describe('POST /pantry/:id/adjust', () => {
  let token: string;
  let userId: string;
  let otherToken: string;
  let otherId: string;

  const signup = async (suffix: string) => {
    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        email: `${PREFIX}-${suffix}@example.com`,
        password: 'TestPass123',
        firstName: 'Adj',
        lastName: 'Ust',
      });
    return { token: res.body.token as string, id: res.body.user.id as string };
  };

  const create = async (quantity: number, unit = 'pieces', t = token) => {
    const res = await request(app)
      .post('/api/v1/pantry')
      .set('Authorization', `Bearer ${t}`)
      .send({ ingredientName: `Item-${randomUUID().slice(0, 6)}`, quantity, unit, category: 'other' })
      .expect(201);
    return res.body.id as string;
  };

  const adjust = (id: string, body: object, t = token) =>
    request(app).post(`/api/v1/pantry/${id}/adjust`).set('Authorization', `Bearer ${t}`).send(body);

  const qtyOf = async (id: string) =>
    (await prisma.pantryItem.findUniqueOrThrow({ where: { id } })).quantity.toString();

  beforeAll(async () => {
    const a = await signup('a');
    const b = await signup('b');
    token = a.token;
    userId = a.id;
    otherToken = b.token;
    otherId = b.id;
  });

  afterAll(async () => {
    await prisma.idempotencyKey?.deleteMany?.({ where: { userId: { in: [userId, otherId] } } }).catch(() => undefined);
    await prisma.pantryItem.deleteMany({ where: { userId: { in: [userId, otherId] } } });
    await prisma.user.deleteMany({ where: { email: { contains: `${PREFIX}-` } } });
  });

  afterEach(() => jest.restoreAllMocks());

  it('applies positive and string deltas', async () => {
    const id = await create(2);
    const up = await adjust(id, { delta: 1 }).expect(200);
    expect(up.body.quantity).toBe('3');
    expect(up.body.clamped).toBe(false);
    const down = await adjust(id, { delta: '-0.5' }).expect(200);
    expect(down.body.quantity).toBe('2.5');
  });

  it('queue orders: +1 then -3 ends 0; -3 then +1 ends 1', async () => {
    const a = await create(2);
    await adjust(a, { delta: 1 }).expect(200);
    const second = await adjust(a, { delta: -3 }).expect(200);
    expect(second.body.clamped).toBe(false);
    expect(await qtyOf(a)).toBe('0');

    const b = await create(2);
    const first = await adjust(b, { delta: -3 }).expect(200);
    expect(first.body.clamped).toBe(true);
    await adjust(b, { delta: 1 }).expect(200);
    expect(await qtyOf(b)).toBe('1');
  });

  it('concurrent adjusts sum correctly', async () => {
    const id = await create(1);
    await adjust(id, { delta: -1 }).expect(200);
    const results = await Promise.all([1, 2, 3, 4, 5].map(() => adjust(id, { delta: 1 })));
    results.forEach((r) => expect(r.status).toBe(200));
    expect(await qtyOf(id)).toBe('5');
  });

  it('clamps at the cap', async () => {
    const id = await create(99990);
    const res = await adjust(id, { delta: 50 }).expect(200);
    expect(res.body.quantity).toBe('99999');
    expect(res.body.clamped).toBe(true);
  });

  it.each([[0], ['abc'], [1.234], [100000], [null], ['']])('rejects delta %p with 400', async (delta) => {
    const id = await create(2);
    await adjust(id, { delta }).expect(400);
    await adjust(id, {}).expect(400);
  });

  it('404 for foreign, soft-deleted and unknown items; 400 for non-UUID', async () => {
    const id = await create(2);
    await adjust(id, { delta: 1 }, otherToken).expect(404);
    expect(await qtyOf(id)).toBe('2');

    const gone = await create(2);
    await prisma.pantryItem.update({ where: { id: gone }, data: { deletedAt: new Date() } });
    await adjust(gone, { delta: 1 }).expect(404);
    await adjust(randomUUID(), { delta: 1 }).expect(404);
    await adjust('not-a-uuid', { delta: 1 }).expect(400);
  });

  it('converts units within a family and rejects other families', async () => {
    const id = await create(1, 'kg');
    const res = await adjust(id, { delta: 500, unit: 'g' }).expect(200);
    expect(res.body.quantity).toBe('1.5');
    expect(res.body.unit).toBe('kg');

    const g = await create(100, 'grams');
    const bad = await adjust(g, { delta: 1, unit: 'ml' }).expect(400);
    expect(bad.body.code ?? bad.body.error?.code).toBe('UNIT_MISMATCH');
    expect(await qtyOf(g)).toBe('100');
  });

  it('replayed Idempotency-Key applies once', async () => {
    const id = await create(2);
    const key = `${PREFIX}-key-${randomUUID()}`;
    const send = () =>
      request(app)
        .post(`/api/v1/pantry/${id}/adjust`)
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', key)
        .send({ delta: 1 });
    const first = await send().expect(200);
    const second = await send().expect(200);
    expect(first.headers['idempotency-replayed']).toBeUndefined();
    expect(second.headers['idempotency-replayed']).toBe('true');
    expect(await qtyOf(id)).toBe('3');
  });

  it('notifies low stock only for 0 < qty <= threshold', async () => {
    const spy = jest.spyOn(lowStock, 'notifyLowStock').mockImplementation(() => undefined);
    const id = await create(5);
    await adjust(id, { delta: -3 }).expect(200);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][1]).toMatchObject({ id });
    await adjust(id, { delta: -2 }).expect(200);
    expect(await qtyOf(id)).toBe('0');
  });
});
