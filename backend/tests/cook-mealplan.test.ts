/**
 * Cook a planned meal once via mealPlanItemId (06-08, CAP-04).
 */

import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database.config';

const app = createApp();
const PREFIX = `cookmp-${Date.now()}`;

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
      firstName: 'Cook',
      lastName: 'Plan',
    });
  return { token: res.body.token, id: res.body.user.id };
};

const createRecipe = async (t: TestUser, servings = 2): Promise<string> => {
  const res = await request(app)
    .post('/api/v1/recipes')
    .set(auth(t))
    .send({
      name: 'Planned cook',
      description: 'test',
      category: 'dinner',
      difficulty: 'easy',
      prepTimeMinutes: 5,
      cookTimeMinutes: 5,
      servings,
      ingredients: [{ ingredientName: 'Seed', quantity: 1, unit: 'grams' }],
      instructions: ['Cook'],
    });
  if (res.status !== 201) throw new Error(JSON.stringify(res.body));
  const id = res.body.id as string;
  await prisma.recipe.update({
    where: { id },
    data: { ingredientsList: [{ ingredientName: 'eggs', quantity: 4, unit: 'pieces' }] },
  });
  return id;
};

const createPlanItem = async (
  t: TestUser,
  recipeId: string,
  servings: number,
  dayOfWeek = 0,
): Promise<{ planId: string; itemId: string }> => {
  const plan = await prisma.mealPlan.create({
    data: {
      userId: t.id,
      name: 'Cook plan',
      startDate: new Date('2026-10-12T00:00:00.000Z'),
      endDate: new Date('2026-10-18T00:00:00.000Z'),
      mealPlanItems: { create: [{ recipeId, dayOfWeek, mealType: 'dinner', servings }] },
    },
    include: { mealPlanItems: true },
  });
  return { planId: plan.id, itemId: plan.mealPlanItems[0].id };
};

const addLot = async (t: TestUser, name: string, quantity: number, unit: string) =>
  (
    await prisma.pantryItem.create({
      data: { userId: t.id, ingredientName: name, quantity, unit, category: 'other' },
    })
  ).id;

/** FEFO may draw from any Eggs lot, so assert on the user's total. */
const totalEggs = async (t: TestUser): Promise<number> => {
  const lots = await prisma.pantryItem.findMany({ where: { userId: t.id } });
  return lots.reduce((sum, l) => sum + Number(l.quantity), 0);
};

const preview = (t: TestUser, body: object) =>
  request(app).post('/api/v1/cook/preview').set(auth(t)).send(body);
const apply = (t: TestUser, body: object) =>
  request(app).post('/api/v1/cook/apply').set(auth(t)).send(body);

describe('Cook a planned meal', () => {
  let a: TestUser;
  let b: TestUser;
  let recipeId: string;

  beforeAll(async () => {
    a = await signup('a');
    b = await signup('b');
    recipeId = await createRecipe(a);
  });

  afterAll(async () => {
    await prisma.mealPlan.deleteMany({ where: { userId: { in: [a.id, b.id] } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  });

  const cookedAtOf = async (itemId: string) =>
    (await prisma.mealPlanItem.findUniqueOrThrow({ where: { id: itemId } })).cookedAt;

  it('previews with the planned servings and echoes the item', async () => {
    const { itemId } = await createPlanItem(a, recipeId, 3);
    await addLot(a, 'Eggs', 20, 'pieces');
    const res = await preview(a, { mealPlanItemId: itemId }).expect(200);
    expect(res.body).toMatchObject({
      servings: 3,
      mealPlanItemId: itemId,
      alreadyCooked: false,
    });
    expect(res.body.rows[0]).toMatchObject({ use: 6 });
  });

  it('applies once, deducts, and marks the meal cooked', async () => {
    const { planId, itemId } = await createPlanItem(a, recipeId, 2);
    await addLot(a, 'Eggs', 10, 'pieces');
    const pv = await preview(a, { mealPlanItemId: itemId }).expect(200);
    const key = pv.body.rows[0].key as string;
    const before = await totalEggs(a);

    await apply(a, {
      mealPlanItemId: itemId,
      deductions: [{ key, unit: 'pieces', use: 4 }],
    }).expect(200);
    const afterFirst = await totalEggs(a);
    expect(afterFirst).toBe(before - 4);

    const plan = await request(app).get(`/api/v1/mealplans/${planId}`).set(auth(a)).expect(200);
    expect(plan.body.meals[0].cookedAt).not.toBeNull();

    const again = await apply(a, {
      mealPlanItemId: itemId,
      deductions: [{ key, unit: 'pieces', use: 4 }],
    }).expect(409);
    expect(again.body.code).toBe('ALREADY_COOKED');
    expect(await totalEggs(a)).toBe(afterFirst);

    const pv2 = await preview(a, { mealPlanItemId: itemId }).expect(200);
    expect(pv2.body.alreadyCooked).toBe(true);
  });

  it('lets exactly one of two concurrent applies win', async () => {
    const { itemId } = await createPlanItem(a, recipeId, 2);
    await addLot(a, 'Eggs', 10, 'pieces');
    const pv = await preview(a, { mealPlanItemId: itemId }).expect(200);
    const key = pv.body.rows[0].key as string;
    const before = await totalEggs(a);
    const body = { mealPlanItemId: itemId, deductions: [{ key, unit: 'pieces', use: 4 }] };

    const results = await Promise.all([apply(a, body), apply(a, body)]);
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([200, 409]);
    expect(await totalEggs(a)).toBe(before - 4);
  });

  it('allows Mark as cooked with no deductions', async () => {
    const { itemId } = await createPlanItem(a, recipeId, 2);
    const res = await apply(a, { mealPlanItemId: itemId, deductions: [] }).expect(200);
    expect(res.body.updated).toBe(0);
    expect(await cookedAtOf(itemId)).not.toBeNull();
  });

  it('rolls back the marker when a deduction is rejected', async () => {
    const { itemId } = await createPlanItem(a, recipeId, 2);
    await addLot(a, 'Eggs', 10, 'pieces');
    const pv = await preview(a, { mealPlanItemId: itemId }).expect(200);
    const key = pv.body.rows[0].key as string;
    await apply(a, {
      mealPlanItemId: itemId,
      deductions: [{ key, unit: 'grams', use: 1 }],
    }).expect(400);
    expect(await cookedAtOf(itemId)).toBeNull();
  });

  it('hides another user item with 404 MEAL_NOT_FOUND', async () => {
    const { itemId } = await createPlanItem(a, recipeId, 2);
    const p = await preview(b, { mealPlanItemId: itemId }).expect(404);
    expect(p.body.code).toBe('MEAL_NOT_FOUND');
    const r = await apply(b, { mealPlanItemId: itemId, deductions: [] }).expect(404);
    expect(r.body.code).toBe('MEAL_NOT_FOUND');
    expect(await cookedAtOf(itemId)).toBeNull();
  });

  it('returns 404 MEAL_NOT_FOUND for an unknown item id', async () => {
    const res = await apply(a, {
      mealPlanItemId: '00000000-0000-4000-8000-000000000000',
      deductions: [],
    }).expect(404);
    expect(res.body.code).toBe('MEAL_NOT_FOUND');
  });

  it('returns 404 RECIPE_NOT_FOUND when the item recipe is soft-deleted', async () => {
    const rid = await createRecipe(a);
    const { itemId } = await createPlanItem(a, rid, 2);
    await prisma.recipe.update({ where: { id: rid }, data: { deletedAt: new Date() } });
    const p = await preview(a, { mealPlanItemId: itemId }).expect(404);
    expect(p.body.code).toBe('RECIPE_NOT_FOUND');
    const r = await apply(a, { mealPlanItemId: itemId, deductions: [] }).expect(404);
    expect(r.body.code).toBe('RECIPE_NOT_FOUND');
    expect(await cookedAtOf(itemId)).toBeNull();
  });

  it('rejects both ids or neither', async () => {
    const { itemId } = await createPlanItem(a, recipeId, 2);
    await preview(a, { recipeId, mealPlanItemId: itemId }).expect(400);
    await preview(a, {}).expect(400);
    await apply(a, { recipeId, mealPlanItemId: itemId, deductions: [] }).expect(400);
    await apply(a, { deductions: [] }).expect(400);
    await preview(a, { mealPlanItemId: 'nope' }).expect(400);
  });

  it('still cooks by recipeId without touching any meal', async () => {
    const { itemId } = await createPlanItem(a, recipeId, 2);
    await apply(a, { recipeId, deductions: [] }).expect(200);
    expect(await cookedAtOf(itemId)).toBeNull();
  });
});
