/**
 * POST /api/v1/shopping/generate (phase 04-06): merge a meal plan into the active list.
 */

import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database.config';

const app = createApp();
const PREFIX = `shopping-gen-${Date.now()}`;

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
      lastName: 'Gen',
    });
  return { token: res.body.token, id: res.body.user.id };
};

const createRecipe = async (
  t: TestUser,
  name: string,
  ingredients: ReadonlyArray<{ ingredientName: string; quantity: number; unit: string }>,
): Promise<string> => {
  const res = await request(app)
    .post('/api/v1/recipes')
    .set(auth(t))
    .send({
      name,
      description: 'test',
      category: 'lunch',
      difficulty: 'easy',
      prepTimeMinutes: 5,
      cookTimeMinutes: 5,
      servings: 2,
      ingredients: [{ ingredientName: 'Seed', quantity: 1, unit: 'grams' }],
      instructions: ['Cook'],
    });
  if (res.status !== 201) throw new Error(JSON.stringify(res.body));
  const id = res.body.id as string;
  // The recipe API restricts units; AI/legacy recipes can hold free-text ones.
  await prisma.recipe.update({ where: { id }, data: { ingredientsList: [...ingredients] } });
  return id;
};

const createPlan = async (t: TestUser, recipeIds: readonly string[]): Promise<string> => {
  const today = new Date();
  const end = new Date(today);
  end.setDate(today.getDate() + 7);
  const res = await request(app)
    .post('/api/v1/mealplans')
    .set(auth(t))
    .send({
      name: 'Gen plan',
      startDate: today.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      meals: recipeIds.map((recipeId, i) => ({
        recipeId,
        dayOfWeek: i,
        mealType: 'lunch',
        servings: 2,
      })),
    })
    .expect(201);
  return res.body.id as string;
};

const generate = (t: TestUser, body: object) =>
  request(app).post('/api/v1/shopping/generate').set(auth(t)).send(body);
const getList = (t: TestUser) => request(app).get('/api/v1/shopping/list').set(auth(t));

describe('POST /api/v1/shopping/generate', () => {
  let a: TestUser;
  let b: TestUser;
  let c: TestUser;
  let planA: string;
  let planEmpty: string;
  let planBig: string;

  beforeAll(async () => {
    a = await signup('a');
    b = await signup('b');
    c = await signup('c');
    const r1 = await createRecipe(a, 'Soup', [
      { ingredientName: 'Onion', quantity: 1, unit: 'pieces' },
      { ingredientName: 'Salt: coarse', quantity: 1, unit: 'tsp' },
      { ingredientName: 'Garlic', quantity: 2, unit: 'clove' },
    ]);
    const r2 = await createRecipe(a, 'Stew', [
      { ingredientName: 'onion', quantity: 2, unit: 'Pieces' },
      { ingredientName: 'Milk', quantity: 1, unit: 'liters' },
    ]);
    planA = await createPlan(a, [r1, r2]);

    const r3 = await createRecipe(b, 'Hollow', [{ ingredientName: 'Temp', quantity: 1, unit: 'g' }]);
    await prisma.recipe.update({ where: { id: r3 }, data: { ingredientsList: [] } });
    planEmpty = await createPlan(b, [r3]);

    const r4 = await createRecipe(c, 'Big', [
      { ingredientName: 'Alpha', quantity: 1, unit: 'g' },
      { ingredientName: 'Beta', quantity: 1, unit: 'g' },
    ]);
    planBig = await createPlan(c, [r4]);
  });

  afterAll(async () => {
    const users = await prisma.user.findMany({
      where: { email: { startsWith: PREFIX } },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    await prisma.shoppingHistory.deleteMany({ where: { userId: { in: ids } } });
    await prisma.shoppingList.deleteMany({ where: { userId: { in: ids } } });
    await prisma.mealPlan.deleteMany({ where: { userId: { in: ids } } });
    await prisma.recipe.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  });

  it('requires auth', async () => {
    await request(app).post('/api/v1/shopping/generate').send({ mealPlanId: planA }).expect(401);
  });

  it('saves the plan ingredients to the active list', async () => {
    const res = await generate(a, { mealPlanId: planA }).expect(200);
    expect(res.body.added).toBe(4);
    expect(res.body.merged).toBe(0);
    expect(res.body.list.mealPlanId).toBe(planA);
    const byName = Object.fromEntries(
      res.body.list.items.map((i: any) => [i.itemName, i]),
    );
    expect(byName['Onion'].quantity).toBe(3);
    expect(byName['Milk'].category).toBe('dairy');
    expect(byName['Salt: coarse']).toBeDefined();
    expect(byName['Garlic'].unit).toBe('clove');

    const saved = await getList(a).expect(200);
    expect(saved.body.items).toHaveLength(4);
  });

  it('merges into unchecked items and adds a new line for checked ones', async () => {
    const second = await generate(a, { mealPlanId: planA }).expect(200);
    expect(second.body.added).toBe(0);
    expect(second.body.merged).toBe(4);
    const onion = second.body.list.items.find((i: any) => i.itemName === 'Onion');
    expect(onion.quantity).toBe(6);

    await request(app)
      .patch(`/api/v1/shopping/items/${onion.id}`)
      .set(auth(a))
      .send({ isChecked: true })
      .expect(200);

    const third = await generate(a, { mealPlanId: planA }).expect(200);
    expect(third.body.added).toBe(1);
    expect(third.body.merged).toBe(3);
    const onions = third.body.list.items.filter((i: any) => i.itemName === 'Onion');
    expect(onions).toHaveLength(2);
  });

  it('rejects a missing or non-uuid mealPlanId with VALIDATION_ERROR', async () => {
    for (const body of [{}, { mealPlanId: 'nope' }]) {
      const res = await generate(a, body).expect(400);
      expect(res.body.error?.code ?? res.body.code).toBe('VALIDATION_ERROR');
    }
  });

  it('returns 404 MEAL_PLAN_NOT_FOUND for another user plan and unknown ids', async () => {
    for (const id of [planEmpty, '00000000-0000-4000-8000-000000000000']) {
      const res = await generate(a, { mealPlanId: id }).expect(404);
      expect(res.body.error?.code ?? res.body.code).toBe('MEAL_PLAN_NOT_FOUND');
    }
  });

  it('returns 400 MEAL_PLAN_EMPTY when the plan has no ingredients', async () => {
    const res = await generate(b, { mealPlanId: planEmpty }).expect(400);
    expect(res.body.error?.code ?? res.body.code).toBe('MEAL_PLAN_EMPTY');
  });

  it('returns 400 SHOPPING_LIST_FULL and writes nothing when over the cap', async () => {
    const list = (await getList(c).expect(200)).body;
    await prisma.shoppingListItem.createMany({
      data: Array.from({ length: 299 }, (_, i) => ({
        shoppingListId: list.id,
        itemName: `filler ${i}`,
        quantity: 1,
        unit: 'pieces',
      })),
    });
    const res = await generate(c, { mealPlanId: planBig }).expect(400);
    expect(res.body.error?.code ?? res.body.code).toBe('SHOPPING_LIST_FULL');
    expect(await prisma.shoppingListItem.count({ where: { shoppingListId: list.id } })).toBe(299);
  });
});
