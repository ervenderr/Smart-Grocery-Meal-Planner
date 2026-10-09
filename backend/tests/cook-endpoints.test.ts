/**
 * POST /api/v1/cook/preview and /apply (06-03).
 */

import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database.config';

const app = createApp();
const PREFIX = `cook-${Date.now()}`;

interface TestUser {
  readonly token: string;
  readonly id: string;
}

type Ingredient = { ingredientName: string; quantity: number; unit: string };

const auth = (t: TestUser) => ({ Authorization: `Bearer ${t.token}` });

const signup = async (suffix: string): Promise<TestUser> => {
  const res = await request(app)
    .post('/api/v1/auth/signup')
    .send({
      email: `${PREFIX}-${suffix}@example.com`,
      password: 'TestPass123',
      firstName: 'Cook',
      lastName: 'Test',
    });
  return { token: res.body.token, id: res.body.user.id };
};

const createRecipe = async (
  t: TestUser,
  ingredients: readonly Ingredient[],
  servings = 2,
): Promise<string> => {
  const res = await request(app)
    .post('/api/v1/recipes')
    .set(auth(t))
    .send({
      name: 'Cook recipe',
      description: 'test',
      category: 'lunch',
      difficulty: 'easy',
      prepTimeMinutes: 5,
      cookTimeMinutes: 5,
      servings,
      ingredients: [{ ingredientName: 'Seed', quantity: 1, unit: 'grams' }],
      instructions: ['Cook'],
    });
  if (res.status !== 201) throw new Error(JSON.stringify(res.body));
  const id = res.body.id as string;
  await prisma.recipe.update({ where: { id }, data: { ingredientsList: [...ingredients] } });
  return id;
};

const addLot = async (
  t: TestUser,
  name: string,
  quantity: number,
  unit: string,
  expiryDate: string | null = null,
): Promise<string> => {
  const row = await prisma.pantryItem.create({
    data: {
      userId: t.id,
      ingredientName: name,
      quantity,
      unit,
      category: 'other',
      expiryDate: expiryDate ? new Date(`${expiryDate}T00:00:00.000Z`) : null,
    },
  });
  return row.id;
};

const qtyOf = async (id: string): Promise<number> =>
  Number((await prisma.pantryItem.findUniqueOrThrow({ where: { id } })).quantity);

const preview = (t: TestUser | null, body: object) => {
  const req = request(app).post('/api/v1/cook/preview');
  return (t ? req.set(auth(t)) : req).send(body);
};
const apply = (t: TestUser | null, body: object) => {
  const req = request(app).post('/api/v1/cook/apply');
  return (t ? req.set(auth(t)) : req).send(body);
};

const FUTURE = '2099-01-01';
const SOON = '2098-01-01';
const PAST = '2020-01-01';

describe('POST /api/v1/cook/preview', () => {
  let a: TestUser;
  let b: TestUser;
  let recipeId: string;

  beforeAll(async () => {
    a = await signup('a');
    b = await signup('b');
    recipeId = await createRecipe(a, [
      { ingredientName: 'eggs', quantity: 4, unit: 'pieces' },
      { ingredientName: 'salt', quantity: 1, unit: 'tsp' },
      { ingredientName: 'saffron', quantity: 1, unit: 'grams' },
    ]);
    await addLot(a, 'Eggs', 12, 'pieces');
    await addLot(a, 'Salt', 500, 'grams');
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  });

  it('requires authentication', async () => {
    await preview(null, { recipeId }).expect(401);
  });

  it('previews with default servings, staples and missing ingredients', async () => {
    const res = await preview(a, { recipeId }).expect(200);
    expect(res.body).toMatchObject({
      recipe: { id: recipeId, servings: 2 },
      servings: 2,
      mealPlanItemId: null,
      alreadyCooked: false,
      staples: ['salt'],
      notInPantry: ['saffron'],
    });
    expect(res.body.rows).toEqual([
      expect.objectContaining({ name: 'Eggs', have: 12, use: 4, left: 8, status: 'ok' }),
    ]);
    expect(res.body.rows[0].key).not.toContain('\u0000');
  });

  it('scales by servings', async () => {
    const res = await preview(a, { recipeId, servings: 1 }).expect(200);
    expect(res.body.rows[0]).toMatchObject({ use: 2, left: 10 });
  });

  it.each([[0], [100], ['x'], [1.5]])('rejects servings %p', async (servings) => {
    await preview(a, { recipeId, servings }).expect(400);
  });

  it('rejects a non-uuid recipeId', async () => {
    await preview(a, { recipeId: 'nope' }).expect(400);
  });

  it('hides another user private recipe', async () => {
    const res = await preview(b, { recipeId }).expect(404);
    expect(res.body.code).toBe('RECIPE_NOT_FOUND');
  });

  it('serves a public recipe using the caller pantry only', async () => {
    await prisma.recipe.update({ where: { id: recipeId }, data: { isPublic: true } });
    const res = await preview(b, { recipeId }).expect(200);
    expect(res.body.rows).toEqual([]);
    expect(res.body.notInPantry).toEqual(expect.arrayContaining(['eggs', 'saffron']));
    await prisma.recipe.update({ where: { id: recipeId }, data: { isPublic: false } });
  });

  it('returns 404 for a soft-deleted recipe', async () => {
    const id = await createRecipe(a, [{ ingredientName: 'eggs', quantity: 1, unit: 'pieces' }]);
    await prisma.recipe.update({ where: { id }, data: { deletedAt: new Date() } });
    const res = await preview(a, { recipeId: id }).expect(404);
    expect(res.body.code).toBe('RECIPE_NOT_FOUND');
  });
});
