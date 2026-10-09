/**
 * Pantry quick-edit tests (CAP-05)
 *
 * PATCH /pantry/:id accepts quantity 0..99999 (used-up state) and clears
 * expiry with null. Create keeps requiring quantity > 0.
 */

import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database.config';

const app = createApp();

const signup = async (email: string) => {
  const response = await request(app)
    .post('/api/v1/auth/signup')
    .send({ email, password: 'TestPass123', firstName: 'Quick', lastName: 'Edit' });
  return { token: response.body.token as string, userId: response.body.user.id as string };
};

describe('Pantry quick edit (PATCH)', () => {
  let tokenA: string;
  let userA: string;
  let tokenB: string;
  let userB: string;
  let itemId: string;

  beforeAll(async () => {
    const a = await signup('pantry-quick-a@example.com');
    const b = await signup('pantry-quick-b@example.com');
    tokenA = a.token;
    userA = a.userId;
    tokenB = b.token;
    userB = b.userId;

    const created = await request(app)
      .post('/api/v1/pantry')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        ingredientName: 'Rice',
        quantity: 500,
        unit: 'grams',
        category: 'grains',
        expiryDate: '2026-12-01',
      })
      .expect(201);
    itemId = created.body.id;
  });

  afterAll(async () => {
    await prisma.pantryItem.deleteMany({ where: { userId: { in: [userA, userB] } } });
    await prisma.user.deleteMany({ where: { email: { contains: 'pantry-quick-' } } });
  });

  const patch = (body: object, token = tokenA, id = itemId) =>
    request(app).patch(`/api/v1/pantry/${id}`).set('Authorization', `Bearer ${token}`).send(body);

  it('accepts quantity 0 and keeps the item listed', async () => {
    const res = await patch({ quantity: 0 }).expect(200);
    expect(Number(res.body.quantity)).toBe(0);

    const list = await request(app)
      .get('/api/v1/pantry')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const ids = (list.body.items as Array<{ id: string }>).map((i) => i.id);
    expect(ids).toContain(itemId);
  });

  it('rejects negative quantity', async () => {
    await patch({ quantity: -1 }).expect(400);
  });

  it('rejects quantity above 99999', async () => {
    await patch({ quantity: 100000 }).expect(400);
  });

  it('rejects non-numeric quantity', async () => {
    await patch({ quantity: 'abc' }).expect(400);
  });

  it('accepts a fractional quantity', async () => {
    const res = await patch({ quantity: 2.5 }).expect(200);
    expect(Number(res.body.quantity)).toBe(2.5);
  });

  it('clears expiry with null and sets it with a date', async () => {
    const cleared = await patch({ expiryDate: null }).expect(200);
    expect(cleared.body.expiryDate).toBeNull();
    await patch({ expiryDate: '2026-12-31' }).expect(200);
  });

  it('still rejects create with quantity 0', async () => {
    await request(app)
      .post('/api/v1/pantry')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ ingredientName: 'Salt', quantity: 0, unit: 'grams', category: 'spices' })
      .expect(400);
  });

  it("returns 404 when patching another user's item", async () => {
    await patch({ quantity: 1 }, tokenB).expect(404);
  });
});
