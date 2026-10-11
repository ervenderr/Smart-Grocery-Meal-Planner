/**
 * Free-tier pantry limit on shopping trip finish (12-07, SUB-02/SUB-03).
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database.config';
import { grantTestEntitlement } from './helpers/entitlement-fixtures';

const app = createApp();
const PREFIX = `shop-fin-limit-${Date.now()}`;
const LIMIT = 25;

interface TestUser {
  readonly token: string;
  readonly id: string;
}

const auth = (t: TestUser) => ({ Authorization: `Bearer ${t.token}` });

const signup = async (suffix: string): Promise<TestUser> => {
  const res = await request(app)
    .post('/api/v1/auth/signup')
    .send({ email: `${PREFIX}-${suffix}@example.com`, password: 'TestPass123', firstName: 'Shop', lastName: 'Lim' });
  return { token: res.body.token as string, id: res.body.user.id as string };
};

const addChecked = async (t: TestUser, name: string): Promise<void> => {
  const res = await request(app)
    .post('/api/v1/shopping/items')
    .set(auth(t))
    .send({ itemName: name, quantity: 1, unit: 'pieces' });
  if (res.status !== 201) throw new Error(JSON.stringify(res.body));
  await request(app)
    .patch(`/api/v1/shopping/items/${res.body.id}`)
    .set(auth(t))
    .send({ isChecked: true })
    .expect(200);
};

const finish = (t: TestUser, body: object = { addToPantry: true }) =>
  request(app).post('/api/v1/shopping/finish').set(auth(t)).send(body);

const seed = (userId: string, active: number) =>
  prisma.pantryItem.createMany({
    data: Array.from({ length: active }, (_, i) => ({
      userId,
      ingredientName: `seed-${i}`,
      quantity: 1,
      unit: 'pieces',
      category: 'other',
    })),
  });

const activeCount = (userId: string) => prisma.pantryItem.count({ where: { userId, deletedAt: null } });

describe('shopping finish free-tier pantry limit', () => {
  const users: TestUser[] = [];
  const newUser = async (suffix: string): Promise<TestUser> => {
    const u = await signup(suffix);
    users.push(u);
    return u;
  };

  afterAll(async () => {
    const ids = users.map((u) => u.id);
    await prisma.pantryItem.deleteMany({ where: { userId: { in: ids } } });
    await prisma.entitlement.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  });

  it('rejects a finish that would create past the limit and rolls everything back', async () => {
    const u = await newUser('over');
    await seed(u.id, 24);
    for (const n of ['alpha', 'bravo', 'charlie']) await addChecked(u, n);

    const res = await finish(u).expect(403);
    expect(res.body).toMatchObject({
      code: 'UPGRADE_REQUIRED',
      limit: LIMIT,
      current: 24,
      adding: 3,
      feature: 'pantry_items',
    });
    expect(await activeCount(u.id)).toBe(24);
    expect(await prisma.shoppingHistory.count({ where: { userId: u.id } })).toBe(0);
    const active = await prisma.shoppingList.findMany({
      where: { userId: u.id, isCompleted: false },
      include: { shoppingListItems: true },
    });
    expect(active).toHaveLength(1);
    expect(active[0].shoppingListItems).toHaveLength(3);
  });

  it('allows a finish that lands exactly on the limit', async () => {
    const u = await newUser('exact');
    await seed(u.id, 24);
    await addChecked(u, 'alpha');
    await finish(u).expect(200);
    expect(await activeCount(u.id)).toBe(LIMIT);
  });

  it('allows merge-only finishes at the limit', async () => {
    const u = await newUser('merge');
    await seed(u.id, LIMIT);
    await addChecked(u, 'seed-0');
    const res = await finish(u).expect(200);
    expect(res.body.pantry).toMatchObject({ added: 0, merged: 1 });
    expect(await activeCount(u.id)).toBe(LIMIT);
  });

  it('allows finishing without addToPantry at the limit', async () => {
    const u = await newUser('off');
    await seed(u.id, LIMIT);
    await addChecked(u, 'alpha');
    await finish(u, {}).expect(200);
    expect(await activeCount(u.id)).toBe(LIMIT);
  });

  it('lets an entitled user exceed the limit', async () => {
    const u = await newUser('paid');
    await seed(u.id, LIMIT);
    await grantTestEntitlement(u.id);
    for (const n of ['alpha', 'bravo', 'charlie']) await addChecked(u, n);
    await finish(u).expect(200);
    expect(await activeCount(u.id)).toBe(LIMIT + 3);
  });

  it('a concurrent create and finish cannot both land past the limit', async () => {
    const u = await newUser('race');
    await seed(u.id, 24);
    await addChecked(u, 'alpha');
    const [create, fin] = await Promise.all([
      request(app)
        .post('/api/v1/pantry')
        .set(auth(u))
        .send({ id: randomUUID(), ingredientName: 'Flour', quantity: 1, unit: 'kg', category: 'grains' }),
      finish(u),
    ]);
    const statuses = [create.status, fin.status];
    expect(statuses.filter((s) => s === 403)).toHaveLength(1);
    expect(statuses.filter((s) => s === 200 || s === 201)).toHaveLength(1);
    expect(await activeCount(u.id)).toBe(LIMIT);
  });
});
