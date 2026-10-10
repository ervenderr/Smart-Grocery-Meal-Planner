/**
 * Idempotency-Key middleware (phase 08-05), real DB.
 */

import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database.config';

const app = createApp();
const PREFIX = `idem-${Date.now()}`;

interface TestUser {
  readonly token: string;
  readonly id: string;
}

const auth = (t: TestUser) => ({ Authorization: `Bearer ${t.token}` });

const signup = async (suffix: string): Promise<TestUser> => {
  const res = await request(app)
    .post('/api/v1/auth/signup')
    .send({
      email: `${PREFIX}-${suffix}@example.com`,
      password: 'TestPass123',
      firstName: 'Idem',
      lastName: 'Potent',
    });
  return { token: res.body.token, id: res.body.user.id };
};

let keyCounter = 0;
const newKey = (): string => `${PREFIX}-key-${++keyCounter}`;

const pantryBody = (name = 'Rice') => ({
  ingredientName: name,
  quantity: 2,
  unit: 'kg',
  category: 'grains',
});

const postPantry = (t: TestUser, key: string | undefined, body: object = pantryBody()) => {
  const req = request(app).post('/api/v1/pantry').set(auth(t));
  if (key !== undefined) req.set('Idempotency-Key', key);
  return req.send(body);
};

const postShoppingItem = (t: TestUser, key: string, body: object) =>
  request(app).post('/api/v1/shopping/items').set(auth(t)).set('Idempotency-Key', key).send(body);

const pantryCount = (t: TestUser) => prisma.pantryItem.count({ where: { userId: t.id } });

describe('Idempotency-Key middleware', () => {
  let u1: TestUser;
  let u2: TestUser;
  let u3: TestUser;

  beforeAll(async () => {
    u1 = await signup('1');
    u2 = await signup('2');
    u3 = await signup('3');
  });

  afterAll(async () => {
    const users = await prisma.user.findMany({
      where: { email: { startsWith: PREFIX } },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    await prisma.idempotencyKey.deleteMany({ where: { userId: { in: ids } } });
    await prisma.shoppingHistory.deleteMany({ where: { userId: { in: ids } } });
    await prisma.shoppingList.deleteMany({ where: { userId: { in: ids } } });
    await prisma.pantryItem.deleteMany({ where: { userId: { in: ids } } });
    await prisma.mealPlan.deleteMany({ where: { userId: { in: ids } } });
    await prisma.recipe.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  });

  it('replay returns the original status and body with Idempotency-Replayed, one row', async () => {
    const key = newKey();
    const first = await postPantry(u1, key);
    const second = await postPantry(u1, key);

    expect(first.status).toBe(201);
    expect(first.headers['idempotency-replayed']).toBeUndefined();
    expect(second.status).toBe(201);
    expect(second.headers['idempotency-replayed']).toBe('true');
    expect(second.body).toEqual(first.body);
    expect(await prisma.pantryItem.count({ where: { userId: u1.id, ingredientName: 'Rice' } })).toBe(1);
  });

  it('returns 422 IDEMPOTENCY_KEY_REUSED for a different body', async () => {
    const key = newKey();
    await postPantry(u1, key).expect(201);
    const res = await postPantry(u1, key, pantryBody('Beans'));
    expect(res.status).toBe(422);
    expect(res.body.code ?? res.body.error?.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('returns 422 for a different route with the same key', async () => {
    const key = newKey();
    await postPantry(u1, key).expect(201);
    const res = await postShoppingItem(u1, key, { itemName: 'Milk' });
    expect(res.status).toBe(422);
  });

  it('returns 422 when only the query string differs (WR-01)', async () => {
    const key = newKey();
    await request(app).post('/api/v1/pantry?a=1').set(auth(u1)).set('Idempotency-Key', key).send(pantryBody()).expect(201);
    const res = await request(app).post('/api/v1/pantry?a=2').set(auth(u1)).set('Idempotency-Key', key).send(pantryBody());
    expect(res.status).toBe(422);
  });

  it('scopes keys per user', async () => {
    const key = newKey();
    const a = await postPantry(u1, key);
    const b = await postPantry(u2, key);
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(b.headers['idempotency-replayed']).toBeUndefined();
    expect(b.body.id).not.toBe(a.body.id);
    expect(await pantryCount(u2)).toBe(1);
  });

  it('handles a concurrent duplicate without a second apply', async () => {
    const key = newKey();
    const before = await pantryCount(u3);
    const [a, b] = await Promise.all([postPantry(u3, key), postPantry(u3, key)]);
    const statuses = [a.status, b.status].sort();
    expect(statuses[0]).toBe(201);
    expect([201, 409]).toContain(statuses[1]);
    if (statuses[1] === 409) {
      const loser = a.status === 409 ? a : b;
      expect(loser.headers['retry-after']).toBe('1');
      expect(loser.body.code ?? loser.body.error?.code).toBe('IDEMPOTENCY_IN_FLIGHT');
    }
    expect(await pantryCount(u3)).toBe(before + 1);
  });

  it('does not cache a non-2xx first attempt', async () => {
    const key = newKey();
    const bad = await postPantry(u1, key, { ingredientName: '' });
    expect(bad.status).toBe(400);
    const good = await postPantry(u1, key);
    expect(good.status).toBe(201);
    expect(good.headers['idempotency-replayed']).toBeUndefined();
  });

  it('behaves as before without the header, and ignores GET', async () => {
    const before = await pantryCount(u2);
    await postPantry(u2, undefined).expect(201);
    await postPantry(u2, undefined).expect(201);
    expect(await pantryCount(u2)).toBe(before + 2);

    const get = await request(app)
      .get('/api/v1/pantry')
      .set(auth(u2))
      .set('Idempotency-Key', 'bad key!');
    expect(get.status).toBe(200);
  });

  it('rejects a malformed key with 400 IDEMPOTENCY_KEY_INVALID', async () => {
    const res = await postPantry(u1, 'bad key!');
    expect(res.status).toBe(400);
    expect(res.body.code ?? res.body.error?.code).toBe('IDEMPOTENCY_KEY_INVALID');
  });

  it('treats an expired row as absent', async () => {
    const key = newKey();
    const first = await postPantry(u1, key).expect(201);
    await prisma.idempotencyKey.updateMany({
      where: { userId: u1.id, key },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const second = await postPantry(u1, key);
    expect(second.status).toBe(201);
    expect(second.headers['idempotency-replayed']).toBeUndefined();
    expect(second.body.id).not.toBe(first.body.id);
  });

  it('takes over a stale in_progress row', async () => {
    const key = newKey();
    await postPantry(u1, key).expect(201);
    await prisma.idempotencyKey.updateMany({
      where: { userId: u1.id, key },
      data: {
        status: 'in_progress',
        responseStatus: null,
        createdAt: new Date(Date.now() - 10 * 60_000),
      },
    });
    const res = await postPantry(u1, key);
    expect(res.status).toBe(201);
    const row = await prisma.idempotencyKey.findUnique({
      where: { userId_key: { userId: u1.id, key } },
    });
    expect(row?.status).toBe('completed');
  });

  it('answers 409 for a fresh in_progress row', async () => {
    const key = newKey();
    await postPantry(u1, key).expect(201);
    await prisma.idempotencyKey.updateMany({
      where: { userId: u1.id, key },
      data: { status: 'in_progress', responseStatus: null },
    });
    const res = await postPantry(u1, key);
    expect(res.status).toBe(409);
    expect(res.headers['retry-after']).toBe('1');
  });

  describe('shopping', () => {
    let u4: TestUser;
    beforeAll(async () => {
      u4 = await signup('4');
    });

    it('finish replay returns the first 200, one history row, pantry merged once', async () => {
      const item = await request(app)
        .post('/api/v1/shopping/items')
        .set(auth(u4))
        .send({ itemName: 'Flour', quantity: 1, unit: 'kg' })
        .expect(201);
      await request(app)
        .patch(`/api/v1/shopping/items/${item.body.id}`)
        .set(auth(u4))
        .send({ isChecked: true, actualCostCents: 400 })
        .expect(200);

      const key = newKey();
      const send = () =>
        request(app)
          .post('/api/v1/shopping/finish')
          .set(auth(u4))
          .set('Idempotency-Key', key)
          .send({ addToPantry: true });
      const first = await send();
      const second = await send();

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(second.headers['idempotency-replayed']).toBe('true');
      expect(second.body).toEqual(first.body);
      expect(await prisma.shoppingHistory.count({ where: { userId: u4.id } })).toBe(1);
      expect(await prisma.pantryItem.count({ where: { userId: u4.id, deletedAt: null } })).toBe(1);
    });

    it('stores a completed row for PATCH on shopping items (mount proof)', async () => {
      const item = await request(app)
        .post('/api/v1/shopping/items')
        .set(auth(u4))
        .send({ itemName: 'Salt2' })
        .expect(201);
      const key = newKey();
      await request(app)
        .patch(`/api/v1/shopping/items/${item.body.id}`)
        .set(auth(u4))
        .set('Idempotency-Key', key)
        .send({ isChecked: true })
        .expect(200);
      const row = await prisma.idempotencyKey.findUnique({
        where: { userId_key: { userId: u4.id, key } },
      });
      expect(row?.status).toBe('completed');
      expect(row?.responseStatus).toBe(200);
    });
  });

  describe('mealplan and cook mounts', () => {
    it('stores a completed row for a mealplan POST', async () => {
      const recipe = await request(app)
        .post('/api/v1/recipes')
        .set(auth(u1))
        .send({
          name: 'Idem Oats',
          description: 'x',
          category: 'breakfast',
          difficulty: 'easy',
          prepTimeMinutes: 5,
          cookTimeMinutes: 10,
          servings: 2,
          ingredients: [{ ingredientName: 'oats', quantity: 1, unit: 'cups' }],
          instructions: ['Cook'],
        })
        .expect(201);
      const key = newKey();
      const body = {
        name: 'Idem plan',
        startDate: '2026-11-02',
        endDate: '2026-11-08',
        meals: [{ recipeId: recipe.body.id, dayOfWeek: 0, mealType: 'breakfast', servings: 2 }],
      };
      const send = () =>
        request(app)
          .post('/api/v1/mealplans')
          .set(auth(u1))
          .set('Idempotency-Key', key)
          .send(body);
      const first = await send();
      const second = await send();
      expect(first.status).toBe(201);
      expect(second.headers['idempotency-replayed']).toBe('true');
      expect(second.body.id).toBe(first.body.id);
      expect(await prisma.mealPlan.count({ where: { userId: u1.id } })).toBe(1);
    });
  });
});
