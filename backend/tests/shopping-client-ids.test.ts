/**
 * Shopping client-generated ids (SYNC-03): retry-safe creates.
 */

import { randomUUID } from 'crypto';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database.config';
import { MAX_ITEMS_PER_LIST } from '../src/modules/shopping/shopping.constants';

const app = createApp();
const EPOCH = Date.now();
const PREFIX = 'shopping-cid';

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
      lastName: 'Cid',
    });
  return { token: res.body.token, id: res.body.user.id };
};

const auth = (t: TestUser) => ({ Authorization: `Bearer ${t.token}` });
const post = (t: TestUser, body: object) =>
  request(app).post('/api/v1/shopping/items').set(auth(t)).send(body);
const patch = (t: TestUser, id: string, body: object) =>
  request(app).patch(`/api/v1/shopping/items/${id}`).set(auth(t)).send(body);
const countItems = (userId: string) =>
  prisma.shoppingListItem.count({ where: { shoppingList: { userId } } });

describe('shopping client ids', () => {
  let a: TestUser;
  let b: TestUser;
  let c: TestUser;
  let d: TestUser;

  beforeAll(async () => {
    [a, b, c, d] = await Promise.all([signup('a'), signup('b'), signup('c'), signup('d')]);
    // Make sure each list exists so concurrent creates serialise on its lock.
    await Promise.all([a, b, c, d].map((u) => post(u, { itemName: 'Seed' }).expect(201)));
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

  it('creates with the client id (201) and replays identical content with 200', async () => {
    const id = randomUUID();
    const first = await post(a, { id, itemName: 'Milk', quantity: 2 }).expect(201);
    expect(first.body.id).toBe(id);
    const before = await countItems(a.id);

    const replay = await post(a, { id, itemName: 'Milk', quantity: 2 }).expect(200);
    expect(replay.body.id).toBe(id);
    expect(replay.body.quantity).toBe(2);
    expect(await countItems(a.id)).toBe(before);
  });

  it('409 CLIENT_ID_CONFLICT when a replayed create has different content (WR-07)', async () => {
    const id = randomUUID();
    await post(a, { id, itemName: 'Eggs', quantity: 2 }).expect(201);
    const res = await post(a, { id, itemName: 'Eggs', quantity: 9 }).expect(409);
    expect(res.body.code ?? res.body.error?.code).toBe('CLIENT_ID_CONFLICT');
    const row = await prisma.shoppingListItem.findUniqueOrThrow({ where: { id } });
    expect(Number(row.quantity)).toBe(2);
  });

  it('replays 200 even when the list is full', async () => {
    const id = randomUUID();
    await post(b, { id, itemName: 'Bread' }).expect(201);
    const existing = await countItems(b.id);
    const list = await prisma.shoppingList.findFirstOrThrow({ where: { userId: b.id } });
    await prisma.shoppingListItem.createMany({
      data: Array.from({ length: MAX_ITEMS_PER_LIST - existing }, (_, i) => ({
        shoppingListId: list.id,
        itemName: `Filler ${i}`,
        quantity: 1,
        unit: 'pieces',
      })),
    });
    expect(await countItems(b.id)).toBe(MAX_ITEMS_PER_LIST);

    await post(b, { id, itemName: 'Bread' }).expect(200);
    const full = await post(b, { itemName: 'One more' }).expect(400);
    expect(full.body.code ?? full.body.error?.code).toBe('SHOPPING_LIST_FULL');
  });

  it("returns 409 CLIENT_ID_CONFLICT for another user's id without leaking data", async () => {
    const id = randomUUID();
    await post(c, { id, itemName: 'SecretItemName' }).expect(201);
    const res = await post(d, { id, itemName: 'Mine' }).expect(409);
    const text = JSON.stringify(res.body);
    expect(text).toContain('CLIENT_ID_CONFLICT');
    expect(text).not.toContain('SecretItemName');
    expect(text).not.toContain('Mine');
    expect(await prisma.shoppingListItem.count({ where: { id } })).toBe(1);
  });

  it('rejects a non-UUID id with 400', async () => {
    await post(a, { id: 'not-a-uuid', itemName: 'X' }).expect(400);
  });

  it('creates without an id as before (201, server id)', async () => {
    const res = await post(a, { itemName: 'Eggs' }).expect(201);
    expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('yields exactly one row for concurrent duplicate creates', async () => {
    const id = randomUUID();
    const [r1, r2] = await Promise.all([
      post(a, { id, itemName: 'Race' }),
      post(a, { id, itemName: 'Race' }),
    ]);
    expect([r1.status, r2.status].sort()).toEqual([200, 201]);
    expect(await prisma.shoppingListItem.count({ where: { id } })).toBe(1);
  });

  it('does not let PATCH change the id', async () => {
    const created = await post(a, { itemName: 'Tea' }).expect(201);
    const newId = randomUUID();
    const res = await patch(a, created.body.id, { id: newId, notes: 'x' });
    expect([200, 400]).toContain(res.status);
    expect(await prisma.shoppingListItem.count({ where: { id: newId } })).toBe(0);
    expect(await prisma.shoppingListItem.count({ where: { id: created.body.id } })).toBe(1);
  });
});
