/**
 * Shopping item endpoints (phase 04-04): POST/PATCH/DELETE, ownership, bounds, cap, undo.
 */

import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database.config';

const app = createApp();
const EPOCH = Date.now();
const PREFIX = `shopping-items`;

interface TestUser {
  readonly token: string;
  readonly id: string;
}

const signup = async (suffix: string): Promise<TestUser> => {
  const res = await request(app)
    .post('/api/v1/auth/signup')
    .send({
      email: `${PREFIX}-${suffix}-${EPOCH}@example.com`,
      password: 'TestPass123',
      firstName: 'Shop',
      lastName: 'Items',
    });
  return { token: res.body.token, id: res.body.user.id };
};

const auth = (t: TestUser) => ({ Authorization: `Bearer ${t.token}` });
const post = (t: TestUser, body: object) =>
  request(app).post('/api/v1/shopping/items').set(auth(t)).send(body);
const patch = (t: TestUser, id: string, body: object) =>
  request(app).patch(`/api/v1/shopping/items/${id}`).set(auth(t)).send(body);
const del = (t: TestUser, id: string) =>
  request(app).delete(`/api/v1/shopping/items/${id}`).set(auth(t));
const getList = (t: TestUser) => request(app).get('/api/v1/shopping/list').set(auth(t));
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const NOT_FOUND = 'SHOPPING_ITEM_NOT_FOUND';
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

describe('shopping items', () => {
  let a: TestUser;
  let b: TestUser;
  let c: TestUser;
  let d: TestUser;

  beforeAll(async () => {
    a = await signup('a');
    b = await signup('b');
    c = await signup('c');
    d = await signup('d');
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

  describe('POST /items', () => {
    it('requires auth', async () => {
      await request(app).post('/api/v1/shopping/items').send({ itemName: 'x' }).expect(401);
    });

    it('creates with defaults, inferred category and lazily creates the list', async () => {
      const res = await post(a, { itemName: 'Milk' }).expect(201);
      expect(res.body).toMatchObject({
        itemName: 'Milk',
        quantity: 1,
        unit: 'pieces',
        category: 'dairy',
        isChecked: false,
      });
      const list = await getList(a).expect(200);
      expect(list.body.items).toHaveLength(1);
    });

    it('infers other for unknown names and when category is empty/null', async () => {
      const r1 = await post(a, { itemName: 'xyzzy', category: '' }).expect(201);
      expect(r1.body.category).toBe('other');
      const r2 = await post(a, { itemName: 'Cheddar cheese', category: null }).expect(201);
      expect(r2.body.category).toBe('dairy');
    });

    it('normalizes pcs to pieces and keeps free text like Clove', async () => {
      const r1 = await post(a, { itemName: 'Bolt', unit: 'pcs' }).expect(201);
      expect(r1.body.unit).toBe('pieces');
      const r2 = await post(a, { itemName: 'Garlic', unit: 'Clove' }).expect(201);
      expect(r2.body.unit).toBe('Clove');
    });

    it.each([
      ['unit with html', { itemName: 'x', unit: '<script>' }],
      ['unit too long', { itemName: 'x', unit: 'a'.repeat(21) }],
      ['unknown category', { itemName: 'x', category: 'produce' }],
      ['empty name', { itemName: '' }],
      ['long name', { itemName: 'n'.repeat(101) }],
      ['quantity 0', { itemName: 'x', quantity: 0 }],
      ['quantity 0.001', { itemName: 'x', quantity: 0.001 }],
      ['quantity 100000', { itemName: 'x', quantity: 100000 }],
      ['negative estimate', { itemName: 'x', costEstimateCents: -1 }],
      ['huge estimate', { itemName: 'x', costEstimateCents: 200000001 }],
      ['huge actual', { itemName: 'x', actualCostCents: 200000001 }],
      ['string isChecked', { itemName: 'x', isChecked: 'true' }],
      ['long notes', { itemName: 'x', notes: 'n'.repeat(501) }],
    ])('rejects %s with VALIDATION_ERROR', async (_label, body) => {
      const res = await post(a, body).expect(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('sanitizes names without HTML escaping', async () => {
      const res = await post(a, { itemName: '  Mac  &  cheese\u0007 ' }).expect(201);
      expect(res.body.itemName).toBe('Mac & cheese');
    });

    it('ignores unknown body fields (mass assignment)', async () => {
      const mine = await getList(a);
      const res = await post(a, {
        itemName: 'Mass',
        shoppingListId: (await getList(b)).body.id,
        id: UNKNOWN_ID,
        userId: b.id,
      }).expect(201);
      expect(res.body.shoppingListId).toBe(mine.body.id);
      expect(res.body.id).not.toBe(UNKNOWN_ID);
      const otherItems = await prisma.shoppingListItem.count({
        where: { shoppingListId: (await getList(b)).body.id },
      });
      expect(otherItems).toBe(0);
    });

    it('enforces the 300 item cap with SHOPPING_LIST_FULL', async () => {
      const list = (await getList(c)).body;
      await prisma.shoppingListItem.createMany({
        data: Array.from({ length: 300 }, (_, i) => ({
          shoppingListId: list.id,
          itemName: `Item ${i}`,
          quantity: 1,
          unit: 'pieces',
        })),
      });
      const res = await post(c, { itemName: 'one too many' }).expect(400);
      expect(res.body.code).toBe('SHOPPING_LIST_FULL');
      expect(await prisma.shoppingListItem.count({ where: { shoppingListId: list.id } })).toBe(300);
    });
  });

  describe('PATCH /items/:id', () => {
    it('checks, is idempotent and a second device sees it', async () => {
      const item = (await post(d, { itemName: 'Bread' }).expect(201)).body;
      const r1 = await patch(d, item.id, { isChecked: true }).expect(200);
      expect(r1.body.isChecked).toBe(true);
      await patch(d, item.id, { isChecked: true }).expect(200);
      const list = await getList(d).expect(200);
      expect(list.body.items.find((i: { id: string }) => i.id === item.id).isChecked).toBe(true);
    });

    it('rejects an empty patch', async () => {
      const item = (await post(d, { itemName: 'Empty' }).expect(201)).body;
      const res = await patch(d, item.id, {}).expect(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('persists each field and rounds quantity to 2 dp', async () => {
      const item = (await post(d, { itemName: 'Edit me' }).expect(201)).body;
      const res = await patch(d, item.id, {
        itemName: 'Edited',
        quantity: 1.239,
        unit: 'kg',
        category: 'fruit',
        costEstimateCents: 500,
        actualCostCents: 450,
        notes: 'ripe',
      }).expect(200);
      expect(res.body).toMatchObject({
        itemName: 'Edited',
        quantity: 1.24,
        unit: 'kg',
        category: 'fruit',
        costEstimateCents: 500,
        actualCostCents: 450,
        notes: 'ripe',
      });
      const reset = await patch(d, item.id, { category: null, notes: null }).expect(200);
      expect(reset.body.category).toBe('other');
      expect(reset.body.notes).toBeNull();
    });

    it('returns 400 for a non-uuid id and 404 for unknown id', async () => {
      await patch(d, 'not-a-uuid', { isChecked: true }).expect(400);
      await del(d, 'not-a-uuid').expect(400);
      const res = await patch(d, UNKNOWN_ID, { isChecked: true }).expect(404);
      expect(res.body.code).toBe(NOT_FOUND);
    });

    it("returns identical 404 for another user's item and leaves it unchanged", async () => {
      const item = (await post(a, { itemName: 'Private' }).expect(201)).body;
      const unknown = await patch(b, UNKNOWN_ID, { isChecked: true }).expect(404);
      const foreign = await patch(b, item.id, { isChecked: true, itemName: 'Hacked' }).expect(404);
      expect(foreign.body.code).toBe(NOT_FOUND);
      expect(foreign.body.message).toBe(unknown.body.message);
      const foreignDel = await del(b, item.id).expect(404);
      expect(foreignDel.body.code).toBe(NOT_FOUND);
      const row = await prisma.shoppingListItem.findUniqueOrThrow({ where: { id: item.id } });
      expect(row.itemName).toBe('Private');
      expect(row.isChecked).toBe(false);
    });

    it('edit after finish returns 404 and leaves the item unchanged', async () => {
      const item = (await post(b, { itemName: 'Finished' }).expect(201)).body;
      await prisma.shoppingList.update({
        where: { id: item.shoppingListId },
        data: { isCompleted: true, completedAt: new Date() },
      });
      const res = await patch(b, item.id, { isChecked: true }).expect(404);
      expect(res.body.code).toBe(NOT_FOUND);
      await del(b, item.id).expect(404);
      const row = await prisma.shoppingListItem.findUniqueOrThrow({ where: { id: item.id } });
      expect(row.isChecked).toBe(false);
    });

    it('edit racing a finish returns 404 and the item is unchanged', async () => {
      const user = await signup('race');
      const item = (await post(user, { itemName: 'Race' }).expect(201)).body;
      let locked: () => void = () => undefined;
      const lockAcquired = new Promise<void>((resolve) => {
        locked = resolve;
      });
      const finisher = prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM shopping_lists WHERE id = ${item.shoppingListId} FOR UPDATE`;
        locked();
        await sleep(300);
        await tx.shoppingList.update({
          where: { id: item.shoppingListId },
          data: { isCompleted: true, completedAt: new Date() },
        });
      });
      await lockAcquired;
      const res = await patch(user, item.id, { isChecked: true });
      await finisher;
      expect(res.status).toBe(404);
      expect(res.body.code).toBe(NOT_FOUND);
      const row = await prisma.shoppingListItem.findUniqueOrThrow({ where: { id: item.id } });
      expect(row.isChecked).toBe(false);
    });
  });

  describe('DELETE /items/:id', () => {
    it('removes the item and supports undo by re-POST', async () => {
      const item = (
        await post(d, {
          itemName: 'Undo me',
          quantity: 3,
          unit: 'kg',
          category: 'fruit',
          costEstimateCents: 300,
          actualCostCents: 250,
          isChecked: true,
          notes: 'n',
        }).expect(201)
      ).body;
      const removed = await del(d, item.id).expect(200);
      expect(removed.body.id).toBe(item.id);
      const { itemName, quantity, unit, category, costEstimateCents, actualCostCents, isChecked, notes } =
        removed.body;
      const again = await post(d, {
        itemName, quantity, unit, category, costEstimateCents, actualCostCents, isChecked, notes,
      }).expect(201);
      expect(again.body).toMatchObject({
        itemName: 'Undo me', quantity: 3, unit: 'kg', category: 'fruit',
        costEstimateCents: 300, actualCostCents: 250, isChecked: true, notes: 'n',
      });
    });

    it('delete twice: one 200 and one 404 (sequential and concurrent)', async () => {
      const item = (await post(d, { itemName: 'Twice' }).expect(201)).body;
      await del(d, item.id).expect(200);
      const second = await del(d, item.id).expect(404);
      expect(second.body.code).toBe(NOT_FOUND);

      const item2 = (await post(d, { itemName: 'Concurrent' }).expect(201)).body;
      const results = await Promise.all([del(d, item2.id), del(d, item2.id)]);
      const statuses = results.map((r) => r.status).sort();
      expect(statuses).toEqual([200, 404]);
      const notFound = results.find((r) => r.status === 404);
      expect(notFound?.body.code).toBe(NOT_FOUND);
    });

    it('undo of a generated clove item succeeds', async () => {
      const list = (await getList(d)).body;
      const row = await prisma.shoppingListItem.create({
        data: { shoppingListId: list.id, itemName: 'Garlic', quantity: 2, unit: 'clove', category: 'vegetable' },
      });
      const removed = await del(d, row.id).expect(200);
      const again = await post(d, {
        itemName: removed.body.itemName,
        quantity: removed.body.quantity,
        unit: removed.body.unit,
        category: removed.body.category,
      }).expect(201);
      expect(again.body.unit).toBe('clove');
    });
  });
});
