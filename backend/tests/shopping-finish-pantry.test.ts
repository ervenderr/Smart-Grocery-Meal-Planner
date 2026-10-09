/**
 * POST /api/v1/shopping/finish with addToPantry (phase 06-04, CAP-03).
 */

import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database.config';
import * as pantryService from '../src/modules/shopping/shopping-pantry.service';

const app = createApp();
const PREFIX = `shopping-fin-pantry-${Date.now()}`;

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
      lastName: 'Pantry',
    });
  return { token: res.body.token, id: res.body.user.id };
};

const addChecked = async (t: TestUser, body: object, checked = true): Promise<void> => {
  const res = await request(app).post('/api/v1/shopping/items').set(auth(t)).send(body);
  if (res.status !== 201) throw new Error(JSON.stringify(res.body));
  if (checked) {
    await request(app)
      .patch(`/api/v1/shopping/items/${res.body.id}`)
      .set(auth(t))
      .send({ isChecked: true })
      .expect(200);
  }
};

const finish = (t: TestUser, body: object = {}) =>
  request(app).post('/api/v1/shopping/finish').set(auth(t)).send(body);

const seedLot = (userId: string, ingredientName: string, quantity: number, unit: string) =>
  prisma.pantryItem.create({
    data: { userId, ingredientName, quantity, unit, category: 'dairy' },
  });

const todayUtc = (): string => new Date().toISOString().slice(0, 10);

const pantryOf = (userId: string) =>
  prisma.pantryItem.findMany({ where: { userId, deletedAt: null }, orderBy: { ingredientName: 'asc' } });

describe('shopping finish addToPantry', () => {
  const users: TestUser[] = [];
  const newUser = async (suffix: string): Promise<TestUser> => {
    const u = await signup(suffix);
    users.push(u);
    return u;
  };

  afterAll(async () => {
    const ids = users.map((u) => u.id);
    await prisma.pantryItem.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  });

  it('merges and creates checked items, ignores unchecked ones', async () => {
    const u = await newUser('main');
    await seedLot(u.id, 'milk', 500, 'ml');
    await addChecked(u, { itemName: 'Milk', quantity: 1, unit: 'liters' });
    await addChecked(u, { itemName: 'Eggs', quantity: 12, unit: 'pieces' });
    await addChecked(u, { itemName: 'Bread' }, false);

    const res = await finish(u, { addToPantry: true, receiptDate: todayUtc() }).expect(200);
    expect(res.body.pantry).toEqual({ added: 1, merged: 1, failed: false });

    const rows = await pantryOf(u.id);
    const milk = rows.find((r) => r.ingredientName === 'milk');
    const eggs = rows.find((r) => r.ingredientName === 'Eggs');
    expect(Number(milk?.quantity)).toBe(1500);
    expect(milk?.unit).toBe('ml');
    expect(Number(eggs?.quantity)).toBe(12);
    expect(eggs?.unit).toBe('pieces');
    expect(eggs?.purchaseDate?.toISOString().slice(0, 10)).toBe(todayUtc());
    expect(rows.find((r) => r.ingredientName === 'Bread')).toBeUndefined();
  });

  it.each([[{}], [{ addToPantry: false }]])(
    'leaves the pantry and response shape alone for %p',
    async (body) => {
      const u = await newUser(`off-${JSON.stringify(body).length}`);
      await addChecked(u, { itemName: 'Rice', quantity: 1, unit: 'kg' });
      const res = await finish(u, body).expect(200);
      expect(Object.keys(res.body).sort()).toEqual(['history', 'list']);
      expect(await pantryOf(u.id)).toHaveLength(0);
    },
  );

  it('rejects a non-boolean addToPantry', async () => {
    const u = await newUser('bad');
    await addChecked(u, { itemName: 'Rice' });
    const res = await finish(u, { addToPantry: 'yes' }).expect(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('keeps the finished trip when the pantry step fails', async () => {
    const u = await newUser('fail');
    await addChecked(u, { itemName: 'Rice', quantity: 1, unit: 'kg' });
    jest.spyOn(pantryService, 'applyPantryMerge').mockRejectedValue(new Error('db down'));

    const res = await finish(u, { addToPantry: true }).expect(200);
    expect(res.body.pantry).toEqual({ added: 0, merged: 0, failed: true });
    expect(await prisma.shoppingHistory.count({ where: { userId: u.id } })).toBe(1);
    expect(await prisma.shoppingList.count({ where: { userId: u.id, isCompleted: true } })).toBe(1);
  });

  it('never merges into another user pantry', async () => {
    const owner = await newUser('owner');
    const buyer = await newUser('buyer');
    const lot = await seedLot(owner.id, 'milk', 500, 'ml');
    await addChecked(buyer, { itemName: 'Milk', quantity: 1, unit: 'liters' });

    const res = await finish(buyer, { addToPantry: true }).expect(200);
    expect(res.body.pantry).toEqual({ added: 1, merged: 0, failed: false });
    const untouched = await prisma.pantryItem.findUniqueOrThrow({ where: { id: lot.id } });
    expect(Number(untouched.quantity)).toBe(500);
    expect(await pantryOf(buyer.id)).toHaveLength(1);
  });
});
