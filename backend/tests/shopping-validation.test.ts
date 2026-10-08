/**
 * Shopping body validation: non-scalar and non-finite values never reach the service (WR-01).
 */

import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database.config';

const app = createApp();
const PREFIX = `shopping-valid-${Date.now()}`;

describe('shopping body validation', () => {
  let token: string;
  let itemId: string;

  const auth = () => ({ Authorization: `Bearer ${token}` });
  const post = (body: object) => request(app).post('/api/v1/shopping/items').set(auth()).send(body);
  const patch = (body: object) =>
    request(app).patch(`/api/v1/shopping/items/${itemId}`).set(auth()).send(body);

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        email: `${PREFIX}@example.com`,
        password: 'TestPass123',
        firstName: 'Shop',
        lastName: 'Valid',
      });
    token = res.body.token;
    itemId = (await post({ itemName: 'Milk' }).expect(201)).body.id;
  });

  afterAll(async () => {
    const users = await prisma.user.findMany({
      where: { email: { startsWith: PREFIX } },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    await prisma.shoppingHistory.deleteMany({ where: { userId: { in: ids } } });
    await prisma.shoppingList.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  });

  const badQuantities: ReadonlyArray<readonly [string, unknown]> = [
    ['array', [1, 2]],
    ['object', {}],
    ['NaN string', 'NaN'],
    ['Infinity string', 'Infinity'],
    ['huge number', 1e308],
    ['huge exponent string', '1e999'],
    ['zero', 0],
    ['above max', 100000],
  ];

  it.each(badQuantities)('rejects quantity (%s) with 400 on create and update', async (_n, v) => {
    const created = await post({ itemName: 'Bad qty', quantity: v });
    expect(created.status).toBe(400);
    expect(created.body.code).toBe('VALIDATION_ERROR');
    const updated = await patch({ quantity: v });
    expect(updated.status).toBe(400);
  });

  const badCents: ReadonlyArray<readonly [string, unknown]> = [
    ['array', [5]],
    ['object', {}],
    ['NaN string', 'NaN'],
    ['Infinity string', 'Infinity'],
    ['huge', 1e30],
    ['negative', -1],
    ['fraction', 1.5],
  ];

  describe.each(['costEstimateCents', 'actualCostCents'])('%s', (field) => {
    it.each(badCents)('rejects %s with 400 on create and update', async (_n, v) => {
      expect((await post({ itemName: 'Bad cents', [field]: v })).status).toBe(400);
      expect((await patch({ [field]: v })).status).toBe(400);
    });

    it('still accepts a whole number and null', async () => {
      expect((await patch({ [field]: 250 })).body[field]).toBe(250);
      expect((await patch({ [field]: null })).status).toBe(200);
    });
  });

  it.each([
    ['itemName array', { itemName: ['a'] }],
    ['itemName object', { itemName: { a: 1 } }],
    ['unit array', { itemName: 'x', unit: ['cups'] }],
    ['category array', { itemName: 'x', category: ['dairy'] }],
    ['isChecked array', { itemName: 'x', isChecked: [true] }],
    ['notes array', { itemName: 'x', notes: ['hi'] }],
  ])('rejects %s with 400', async (_n, body) => {
    expect((await post(body)).status).toBe(400);
  });

  it('rejects array-valued fields on update and leaves the item unchanged', async () => {
    await patch({ category: ['dairy'] }).expect(400);
    await patch({ isChecked: [true] }).expect(400);
    await patch({ unit: ['cups'] }).expect(400);
    const list = await request(app).get('/api/v1/shopping/list').set(auth()).expect(200);
    const item = list.body.items.find((i: { id: string }) => i.id === itemId);
    expect(item).toMatchObject({ quantity: 1, isChecked: false });
  });

  it('accepts numeric strings and normal values', async () => {
    const res = await post({ itemName: 'Okay', quantity: '2.5', costEstimateCents: '199' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ quantity: 2.5, costEstimateCents: 199 });
  });
});
