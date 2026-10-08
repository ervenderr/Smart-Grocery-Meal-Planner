/**
 * POST /api/v1/shopping/finish and GET /api/v1/shopping/history (phase 04-08).
 */

import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database.config';

const app = createApp();
const PREFIX = `shopping-fin-${Date.now()}`;

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
      firstName: 'Shop',
      lastName: 'Fin',
    });
  return { token: res.body.token, id: res.body.user.id };
};

const addItem = async (t: TestUser, body: object): Promise<any> => {
  const res = await request(app).post('/api/v1/shopping/items').set(auth(t)).send(body);
  if (res.status !== 201) throw new Error(JSON.stringify(res.body));
  return res.body;
};

const patchItem = (t: TestUser, id: string, body: object) =>
  request(app).patch(`/api/v1/shopping/items/${id}`).set(auth(t)).send(body);

const finish = (t: TestUser, body: object = {}) =>
  request(app).post('/api/v1/shopping/finish').set(auth(t)).send(body);

const history = (t: TestUser, qs = '') =>
  request(app).get(`/api/v1/shopping/history${qs}`).set(auth(t));

const dayOffset = (days: number): string => {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days));
  return d.toISOString().slice(0, 10);
};

/** Builds the A/B/C list from the spec: A checked actual 500, B checked est 300, C unchecked est 200 actual 100. */
const seedTrip = async (t: TestUser) => {
  const a = await addItem(t, { itemName: 'Rice' });
  const b = await addItem(t, { itemName: 'Beans', costEstimateCents: 300 });
  const c = await addItem(t, { itemName: 'Eggs', costEstimateCents: 200, notes: 'free range' });
  await patchItem(t, a.id, { isChecked: true, actualCostCents: 500 }).expect(200);
  await patchItem(t, b.id, { isChecked: true }).expect(200);
  await patchItem(t, c.id, { actualCostCents: 100 }).expect(200);
  return { a, b, c };
};

describe('shopping finish and history', () => {
  let u1: TestUser;
  let u2: TestUser;
  let u3: TestUser;
  let u4: TestUser;
  let u5: TestUser;
  let u6: TestUser;

  beforeAll(async () => {
    u1 = await signup('1');
    u2 = await signup('2');
    u3 = await signup('3');
    u4 = await signup('4');
    u5 = await signup('5');
    u6 = await signup('6');
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

  it('requires auth', async () => {
    await request(app).post('/api/v1/shopping/finish').send({}).expect(401);
    await request(app).get('/api/v1/shopping/history').expect(401);
  });

  describe('carry over (default)', () => {
    let result: any;
    let seeded: Awaited<ReturnType<typeof seedTrip>>;
    let oldListId: string;

    beforeAll(async () => {
      seeded = await seedTrip(u1);
      oldListId = (await request(app).get('/api/v1/shopping/list').set(auth(u1))).body.id;
      result = (await finish(u1).expect(200)).body;
    });

    it('writes a history row with the checked total', async () => {
      expect(result.history.totalCents).toBe(800);
      expect(result.history.estimatedCents).toBe(300);
      expect(result.history.itemCount).toBe(3);
      expect(result.history.receiptDate).toBe(dayOffset(0));
      expect(result.history.shoppingListId).toBe(oldListId);
      const row = await prisma.shoppingHistory.findFirstOrThrow({ where: { userId: u1.id } });
      expect(row.totalPhpCents).toBe(800);
    });

    it('completes the old list', async () => {
      const old = await prisma.shoppingList.findUniqueOrThrow({ where: { id: oldListId } });
      expect(old.isCompleted).toBe(true);
      expect(old.completedAt).not.toBeNull();
      expect(old.totalCostCents).toBe(800);
    });

    it('carries unchecked items to a new active list', async () => {
      expect(result.list.id).not.toBe(oldListId);
      expect(result.list.items).toHaveLength(1);
      const [carried] = result.list.items;
      expect(carried.itemName).toBe('Eggs');
      expect(carried.isChecked).toBe(false);
      expect(carried.actualCostCents).toBeNull();
      expect(carried.costEstimateCents).toBe(200);
      expect(carried.notes).toBe('free range');
      expect(carried.id).not.toBe(seeded.c.id);
      const active = await prisma.shoppingList.count({
        where: { userId: u1.id, isCompleted: false },
      });
      expect(active).toBe(1);
    });

    it('rejects editing an item of the completed list', async () => {
      const res = await patchItem(u1, seeded.a.id, { isChecked: false }).expect(404);
      expect(res.body.code ?? res.body.error?.code).toBe('SHOPPING_ITEM_NOT_FOUND');
    });

    it('rejects a repeat finish after carry-over without a second history row', async () => {
      const res = await finish(u1).expect(400);
      expect(JSON.stringify(res.body)).toContain('SHOPPING_LIST_NOTHING_CHECKED');
      expect(await prisma.shoppingHistory.count({ where: { userId: u1.id } })).toBe(1);
    });
  });

  it('discards unchecked items when asked', async () => {
    await seedTrip(u2);
    const res = await finish(u2, { carryOver: 'discard' }).expect(200);
    expect(res.body.list.items).toHaveLength(0);
    expect(res.body.history.totalCents).toBe(800);
  });

  it('rejects an invalid carryOver', async () => {
    await finish(u3, { carryOver: 'keep' }).expect(400);
    await finish(u3, { carryOver: 5 }).expect(400);
  });

  it('rejects finishing with no list or an empty list', async () => {
    const none = await finish(u3).expect(400);
    expect(JSON.stringify(none.body)).toContain('SHOPPING_LIST_EMPTY');
    await request(app).get('/api/v1/shopping/list').set(auth(u3)).expect(200);
    const empty = await finish(u3).expect(400);
    expect(JSON.stringify(empty.body)).toContain('SHOPPING_LIST_EMPTY');
    expect(await prisma.shoppingHistory.count({ where: { userId: u3.id } })).toBe(0);
  });

  it('rejects finishing when nothing is checked and leaves the list active', async () => {
    await addItem(u3, { itemName: 'Milk' });
    const res = await finish(u3).expect(400);
    expect(JSON.stringify(res.body)).toContain('Check off at least one item before finishing this trip.');
    expect(JSON.stringify(res.body)).toContain('SHOPPING_LIST_NOTHING_CHECKED');
    expect(await prisma.shoppingHistory.count({ where: { userId: u3.id } })).toBe(0);
    expect(await prisma.shoppingList.count({ where: { userId: u3.id, isCompleted: false } })).toBe(1);
  });

  describe('receiptDate', () => {
    it.each([1, -1])('accepts UTC today offset %i', async (offset) => {
      const user = offset === 1 ? u4 : u5;
      const item = await addItem(user, { itemName: 'Tea' });
      await patchItem(user, item.id, { isChecked: true }).expect(200);
      const date = dayOffset(offset);
      const res = await finish(user, { receiptDate: date }).expect(200);
      expect(res.body.history.receiptDate).toBe(date);
    });

    it.each([dayOffset(2), dayOffset(-2), '2026-13-01', '10/09/2026', 20261009])(
      'rejects %s',
      async (value) => {
        const res = await finish(u6, { receiptDate: value }).expect(400);
        expect(JSON.stringify(res.body)).toContain('VALIDATION_ERROR');
      },
    );
  });

  describe('GET /history', () => {
    it('returns newest first and paginates', async () => {
      const item = await addItem(u4, { itemName: 'Jam', costEstimateCents: 100 });
      await patchItem(u4, item.id, { isChecked: true }).expect(200);
      await finish(u4).expect(200);

      const all = (await history(u4).expect(200)).body;
      expect(all.items).toHaveLength(2);
      expect(all.items[0].receiptDate >= all.items[1].receiptDate).toBe(true);
      expect(all.items[0]).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          totalCents: expect.any(Number),
          estimatedCents: expect.any(Number),
          itemCount: expect.any(Number),
          listName: 'Shopping list',
          shoppingListId: expect.any(String),
        }),
      );
      expect(all.items[0].receiptDate).toBe(dayOffset(1));

      const p1 = (await history(u4, '?page=1&limit=1').expect(200)).body;
      expect(p1.items).toHaveLength(1);
      expect(p1.pagination).toEqual({ page: 1, limit: 1, total: 2, totalPages: 2 });
      const p2 = (await history(u4, '?page=2&limit=1').expect(200)).body;
      expect(p2.items[0].id).not.toBe(p1.items[0].id);
    });

    it('rejects bad pagination', async () => {
      await history(u4, '?limit=51').expect(400);
      await history(u4, '?page=0').expect(400);
    });

    it('never shows another user history', async () => {
      const mine = (await history(u1).expect(200)).body;
      expect(mine.items).toHaveLength(1);
      const theirs = (await history(u6).expect(200)).body;
      expect(theirs.items).toHaveLength(0);
      expect(theirs.pagination.total).toBe(0);
    });
  });
});
