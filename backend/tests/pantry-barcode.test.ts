/**
 * Pantry barcode tests (CAP-01, CAP-02)
 *
 * Barcode is an optional 8-14 digit string on create/update (null clears it)
 * and GET /pantry?barcode= filters to the caller's non-deleted items.
 */

import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database.config';

const app = createApp();
const CODE = '4800016644801';

const signup = async (email: string) => {
  const response = await request(app)
    .post('/api/v1/auth/signup')
    .send({ email, password: 'TestPass123', firstName: 'Bar', lastName: 'Code' });
  return { token: response.body.token as string, userId: response.body.user.id as string };
};

describe('Pantry barcode', () => {
  let tokenA: string;
  let userA: string;
  let tokenB: string;
  let userB: string;

  beforeAll(async () => {
    const a = await signup('pantry-barcode-a@example.com');
    const b = await signup('pantry-barcode-b@example.com');
    tokenA = a.token;
    userA = a.userId;
    tokenB = b.token;
    userB = b.userId;
  });

  afterAll(async () => {
    await prisma.pantryItem.deleteMany({ where: { userId: { in: [userA, userB] } } });
    await prisma.user.deleteMany({ where: { email: { contains: 'pantry-barcode-' } } });
  });

  const base = { ingredientName: 'Noodles', quantity: 2, unit: 'pieces', category: 'grains' };
  const create = (body: object, token = tokenA) =>
    request(app).post('/api/v1/pantry').set('Authorization', `Bearer ${token}`).send(body);
  const patch = (id: string, body: object, token = tokenA) =>
    request(app).patch(`/api/v1/pantry/${id}`).set('Authorization', `Bearer ${token}`).send(body);
  const list = (qs: string, token = tokenA) =>
    request(app).get(`/api/v1/pantry?${qs}`).set('Authorization', `Bearer ${token}`);

  describe('create', () => {
    it('stores and returns the barcode', async () => {
      const res = await create({ ...base, barcode: CODE }).expect(201);
      expect(res.body.barcode).toBe(CODE);
    });

    it('returns null when no barcode is given', async () => {
      const res = await create(base).expect(201);
      expect(res.body.barcode).toBeNull();
    });

    it.each([['1234567'], ['123456789012345'], ['12ab5678'], [12345678]])(
      'rejects invalid barcode %p',
      async (barcode) => {
        await create({ ...base, barcode }).expect(400);
      }
    );
  });

  describe('update', () => {
    let id: string;
    beforeAll(async () => {
      id = (await create(base).expect(201)).body.id;
    });

    it('sets then clears the barcode', async () => {
      const set = await patch(id, { barcode: '12345678' }).expect(200);
      expect(set.body.barcode).toBe('12345678');
      const cleared = await patch(id, { barcode: null }).expect(200);
      expect(cleared.body.barcode).toBeNull();
    });

    it('rejects a malformed barcode', async () => {
      await patch(id, { barcode: 'x' }).expect(400);
    });
  });

  describe('list by barcode', () => {
    it('returns only the newest matching item of the caller', async () => {
      const code = '5000112637922';
      await create({ ...base, ingredientName: 'Old', barcode: code }).expect(201);
      const newest = await create({ ...base, ingredientName: 'New', barcode: code }).expect(201);
      await create({ ...base, ingredientName: 'Other', barcode: '9999999999999' }).expect(201);

      const res = await list(`barcode=${code}&limit=1&sortBy=createdAt&sortOrder=desc`).expect(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].id).toBe(newest.body.id);
    });

    it('never leaks another user items', async () => {
      const code = '7622210449283';
      await create({ ...base, barcode: code }, tokenB).expect(201);
      const res = await list(`barcode=${code}`).expect(200);
      expect(res.body.items).toHaveLength(0);
    });

    it('excludes soft-deleted items', async () => {
      const code = '8000500310427';
      const item = await create({ ...base, barcode: code }).expect(201);
      await request(app)
        .delete(`/api/v1/pantry/${item.body.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(204);
      const res = await list(`barcode=${code}`).expect(200);
      expect(res.body.items).toHaveLength(0);
    });

    it('rejects a malformed barcode query', async () => {
      await list('barcode=abc').expect(400);
    });
  });
});
