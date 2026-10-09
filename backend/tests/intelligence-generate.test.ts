/**
 * POST /api/v1/shopping/generate (phase 05-09): staples, pantry subtraction,
 * unit-aware merge and the additive response.
 */

import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database.config';
import { isPantryCapped } from '../src/modules/shopping/shopping-generate.service';

const app = createApp();
const PREFIX = `intel-gen-${Date.now()}`;
const DAY_MS = 86_400_000;

interface TestUser {
  readonly token: string;
  readonly id: string;
}
type Ing = {
  readonly ingredientName: string;
  readonly quantity: number;
  readonly unit: string;
};

const auth = (t: TestUser) => ({ Authorization: `Bearer ${t.token}` });

const signup = async (suffix: string): Promise<TestUser> => {
  const res = await request(app)
    .post('/api/v1/auth/signup')
    .send({
      email: `${PREFIX}-${suffix}@example.com`,
      password: 'TestPass123',
      firstName: 'Intel',
      lastName: 'Gen',
    });
  return { token: res.body.token, id: res.body.user.id };
};

const createRecipe = async (t: TestUser, name: string, ingredients: readonly Ing[]) => {
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
      name: 'Intel plan',
      startDate: today.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      meals: recipeIds.map((recipeId, i) => ({ recipeId, dayOfWeek: i, mealType: 'lunch', servings: 2 })),
    })
    .expect(201);
  return res.body.id as string;
};

const planWith = async (t: TestUser, name: string, ings: readonly Ing[]) =>
  createPlan(t, [await createRecipe(t, name, ings)]);

const pantry = (
  userId: string,
  ingredientName: string,
  quantity: number,
  unit: string,
  expiryDate: Date | null = null,
  deletedAt: Date | null = null,
) =>
  prisma.pantryItem.create({
    data: { userId, ingredientName, quantity, unit, category: 'other', expiryDate, deletedAt },
  });

const setStaples = (userId: string, stapleNames: string[]) =>
  prisma.userPreference.update({ where: { userId }, data: { stapleNames } });

const generate = (t: TestUser, body: object) =>
  request(app).post('/api/v1/shopping/generate').set(auth(t)).send(body);
const getList = (t: TestUser) => request(app).get('/api/v1/shopping/list').set(auth(t));
const line = (items: any[], re: RegExp) => items.find((i) => re.test(i.itemName));

describe('POST /api/v1/shopping/generate with pantry and staples', () => {
  let main: TestUser;
  let other: TestUser;
  let planMain: string;

  beforeAll(async () => {
    main = await signup('main');
    other = await signup('other');
    const tomorrow10 = new Date(Date.now() + 10 * DAY_MS);
    const yesterday = new Date(Date.now() - DAY_MS);
    await pantry(main.id, 'Rice', 1, 'kg');
    await pantry(main.id, 'Rolled Oats', 400, 'grams', tomorrow10);
    await pantry(main.id, 'Milk', 1, 'pieces');
    await pantry(main.id, 'Spinach', 500, 'grams', yesterday);
    await pantry(main.id, 'Bread Flour', 50, 'kg', null, new Date());
    await pantry(other.id, 'Rice', 10, 'kg');

    const r1 = await createRecipe(main, 'Big', [
      { ingredientName: 'Rice', quantity: 500, unit: 'grams' },
      { ingredientName: 'Rolled Oats', quantity: 1, unit: 'kg' },
      { ingredientName: 'Milk', quantity: 2, unit: 'cups' },
      { ingredientName: 'Spinach', quantity: 200, unit: 'grams' },
      { ingredientName: 'Salt', quantity: 1, unit: 'tsp' },
      { ingredientName: 'Bread Flour', quantity: 500, unit: 'grams' },
    ]);
    const r2 = await createRecipe(main, 'Dough', [
      { ingredientName: 'bread flour', quantity: 1, unit: 'kg' },
    ]);
    planMain = await createPlan(main, [r1, r2]);
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
    await prisma.pantryItem.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  });

  it('subtracts pantry, skips staples and reports covered entries', async () => {
    const res = await generate(main, { mealPlanId: planMain }).expect(200);
    for (const key of ['list', 'added', 'merged', 'covered', 'skippedStaples', 'pantryCapped']) {
      expect(res.body).toHaveProperty(key);
    }
    expect(res.body.pantryCapped).toBe(false);

    const covered: any[] = res.body.covered;
    const find = (re: RegExp) => covered.find((c) => re.test(c.name));
    expect(find(/rice/i)).toMatchObject({ status: 'full' });
    expect(find(/oats/i)).toMatchObject({ status: 'partial', needed: 1, have: 0.4, unit: 'kg' });
    expect(find(/milk/i)).toMatchObject({ status: 'incompatible', haveUnit: 'pieces' });
    expect(find(/spinach/i)).toBeUndefined();
    expect(find(/flour/i)).toBeUndefined();

    expect(res.body.skippedStaples.map((s: string) => s.toLowerCase())).toEqual(['salt']);

    const items: any[] = res.body.list.items;
    expect(line(items, /rice/i)).toBeUndefined();
    expect(line(items, /salt/i)).toBeUndefined();
    expect(line(items, /oats/i)).toMatchObject({ quantity: 600, unit: 'grams' });
    expect(line(items, /milk/i)).toMatchObject({ quantity: 2, unit: 'cups' });
    expect(line(items, /spinach/i)).toMatchObject({ quantity: 200, unit: 'grams' });
    expect(line(items, /flour/i)).toMatchObject({ quantity: 1.5, unit: 'kg' });
    expect(res.body.added).toBe(4);
  });

  it('never lets another user pantry or soft-deleted rows cover needs', async () => {
    const user = await signup('isolated');
    await pantry(user.id, 'Bread Flour', 9, 'kg', null, new Date());
    const plan = await planWith(user, 'Rice', [
      { ingredientName: 'Rice', quantity: 1, unit: 'kg' },
      { ingredientName: 'Bread Flour', quantity: 1, unit: 'kg' },
    ]);
    const res = await generate(user, { mealPlanId: plan }).expect(200);
    expect(res.body.covered).toEqual([]);
    expect(res.body.added).toBe(2);
  });

  it('persists the converted unit when merging into an unchecked row', async () => {
    const user = await signup('merge');
    await setStaples(user.id, []);
    const plan = await planWith(user, 'Dough', [
      { ingredientName: 'Bread Flour', quantity: 1, unit: 'kg' },
    ]);
    const list = (await getList(user).expect(200)).body;
    await prisma.shoppingListItem.create({
      data: { shoppingListId: list.id, itemName: 'Bread Flour', quantity: 500, unit: 'grams' },
    });
    const res = await generate(user, { mealPlanId: plan }).expect(200);
    expect(res.body.merged).toBe(1);
    expect(res.body.added).toBe(0);
    const fresh = (await getList(user).expect(200)).body.items;
    expect(fresh).toHaveLength(1);
    expect(fresh[0]).toMatchObject({ quantity: 1.5, unit: 'kg' });
  });

  it('returns 200 with added 0 when pantry and staples cover everything', async () => {
    const user = await signup('covered');
    await pantry(user.id, 'Rice', 5, 'kg');
    const plan = await planWith(user, 'Plain', [
      { ingredientName: 'Rice', quantity: 1, unit: 'kg' },
      { ingredientName: 'Salt', quantity: 1, unit: 'tsp' },
    ]);
    const res = await generate(user, { mealPlanId: plan }).expect(200);
    expect(res.body.added).toBe(0);
    expect(res.body.merged).toBe(0);
    expect(res.body.covered.length).toBeGreaterThan(0);
    expect(res.body.list.items).toHaveLength(0);
  });

  it('keeps salt when the user has no staples and matches staples exactly', async () => {
    const none = await signup('nostaples');
    await setStaples(none.id, []);
    const planNone = await planWith(none, 'Salty', [{ ingredientName: 'Salt', quantity: 1, unit: 'tsp' }]);
    const resNone = await generate(none, { mealPlanId: planNone }).expect(200);
    expect(line(resNone.body.list.items, /salt/i)).toBeDefined();
    expect(resNone.body.skippedStaples).toEqual([]);

    const pep = await signup('pepper');
    await setStaples(pep.id, ['pepper']);
    const planPep = await planWith(pep, 'Peppers', [
      { ingredientName: 'Pepper', quantity: 1, unit: 'tsp' },
      { ingredientName: 'Bell Pepper', quantity: 2, unit: 'pieces' },
    ]);
    const resPep = await generate(pep, { mealPlanId: planPep }).expect(200);
    expect(resPep.body.list.items.map((i: any) => i.itemName)).toEqual(['Bell Pepper']);
    expect(resPep.body.skippedStaples).toHaveLength(1);
  });

  it('does not filter manually added staples', async () => {
    const res = await request(app)
      .post('/api/v1/shopping/items')
      .set(auth(main))
      .send({ itemName: 'Salt', quantity: 1, unit: 'pieces' });
    expect(res.status).toBe(201);
  });
});

describe('isPantryCapped', () => {
  it('is true only when the read hit the cap', () => {
    expect(isPantryCapped(2000, 2000)).toBe(true);
    expect(isPantryCapped(1999, 2000)).toBe(false);
  });
});
