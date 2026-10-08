/**
 * Shopping list tests (phase 04-01): lazy create, concurrency, one active list, auth, persistence.
 */

import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database.config';

const app = createApp();
const PREFIX = `shopping-list-${Date.now()}`;

interface TestUser {
  readonly token: string;
  readonly id: string;
}

const signup = async (suffix: string): Promise<TestUser> => {
  const res = await request(app)
    .post('/api/v1/auth/signup')
    .send({
      email: `${PREFIX}-${suffix}@example.com`,
      password: 'TestPass123',
      firstName: 'Shop',
      lastName: 'Test',
    });
  return { token: res.body.token, id: res.body.user.id };
};

const getList = (token: string) =>
  request(app).get('/api/v1/shopping/list').set('Authorization', `Bearer ${token}`);

const activeCount = (userId: string) =>
  prisma.shoppingList.count({ where: { userId, isCompleted: false, deletedAt: null } });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('GET /api/v1/shopping/list', () => {
  let userA: TestUser;
  let userB: TestUser;
  let userC: TestUser;
  let userD: TestUser;

  beforeAll(async () => {
    userA = await signup('a');
    userB = await signup('b');
    userC = await signup('c');
    userD = await signup('d');
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

  it('returns 401 without a token', async () => {
    await request(app).get('/api/v1/shopping/list').expect(401);
  });

  it('lazy create: first GET creates the list and the second returns the same id', async () => {
    const first = await getList(userA.token).expect(200);
    expect(first.body).toMatchObject({
      name: 'Shopping list',
      mealPlanId: null,
      isCompleted: false,
      items: [],
    });
    const second = await getList(userA.token).expect(200);
    expect(second.body.id).toBe(first.body.id);
  });

  it('gives a different list to a different user', async () => {
    const a = await getList(userA.token).expect(200);
    const b = await getList(userB.token).expect(200);
    expect(b.body.id).not.toBe(a.body.id);
  });

  it('concurrent GETs for a new user produce exactly one active list', async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, () => getList(userC.token)),
    );
    results.forEach((r) => expect(r.status).toBe(200));
    expect(new Set(results.map((r) => r.body.id)).size).toBe(1);
    expect(await activeCount(userC.id)).toBe(1);
  });

  it('one active list: a direct second active INSERT is rejected by the database', async () => {
    await getList(userA.token).expect(200);
    await expect(
      prisma.$executeRaw`INSERT INTO shopping_lists (id, user_id, name, updated_at)
        VALUES (${randomUUID()}, ${userA.id}, 'dup', now())`,
    ).rejects.toThrow();
    expect(await activeCount(userA.id)).toBe(1);
  });

  it('persist: stored items are returned with numeric quantity and default category', async () => {
    const list = await getList(userA.token).expect(200);
    await prisma.shoppingListItem.create({
      data: { shoppingListId: list.body.id, itemName: 'Rice', quantity: 1.5, unit: 'kg' },
    });
    const again = await getList(userA.token).expect(200);
    expect(again.body.id).toBe(list.body.id);
    expect(again.body.items).toHaveLength(1);
    expect(again.body.items[0]).toMatchObject({
      itemName: 'Rice',
      quantity: 1.5,
      unit: 'kg',
      category: 'other',
      isChecked: false,
    });
    expect(typeof again.body.items[0].quantity).toBe('number');
  });

  it('retry: a list completed by a concurrent transaction yields a fresh active list', async () => {
    const original = await getList(userD.token).expect(200);

    const locker = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM shopping_lists WHERE id = ${original.body.id} FOR UPDATE`;
      await tx.$executeRaw`UPDATE shopping_lists
        SET is_completed = true, completed_at = now(), updated_at = now()
        WHERE id = ${original.body.id}`;
      await sleep(300);
    });

    await sleep(100);
    const res = await getList(userD.token);
    await locker;

    expect(res.status).toBe(200);
    expect(res.body.id).not.toBe(original.body.id);
    expect(await activeCount(userD.id)).toBe(1);
  });
});
