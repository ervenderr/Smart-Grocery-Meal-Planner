/**
 * Meal plan create/update with the same recipe used in several meals.
 */

import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database.config';

const app = createApp();
const PREFIX = `mpdup-${Date.now()}`;

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
      firstName: 'Dup',
      lastName: 'Recipe',
    });
  return { token: res.body.token, id: res.body.user.id };
};

const createRecipe = async (t: TestUser): Promise<string> => {
  const res = await request(app)
    .post('/api/v1/recipes')
    .set(auth(t))
    .send({
      name: 'Dup recipe',
      description: 'test',
      category: 'dinner',
      difficulty: 'easy',
      prepTimeMinutes: 5,
      cookTimeMinutes: 5,
      servings: 2,
      ingredients: [{ ingredientName: 'Seed', quantity: 1, unit: 'grams' }],
      instructions: ['Cook'],
    });
  if (res.status !== 201) throw new Error(JSON.stringify(res.body));
  return res.body.id as string;
};

const meal = (recipeId: string, dayOfWeek: number, mealType = 'dinner') => ({
  recipeId,
  dayOfWeek,
  mealType,
  servings: 2,
});

const planBody = (meals: object[]) => ({
  name: 'Dup plan',
  startDate: '2026-10-12T00:00:00.000Z',
  endDate: '2026-10-18T00:00:00.000Z',
  meals,
});

describe('Meal plans reusing a recipe', () => {
  let a: TestUser;
  let b: TestUser;
  let recipeA: string;
  let recipeA2: string;
  let recipeB: string;

  beforeAll(async () => {
    a = await signup('a');
    b = await signup('b');
    recipeA = await createRecipe(a);
    recipeA2 = await createRecipe(a);
    recipeB = await createRecipe(b);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  });

  const create = (t: TestUser, meals: object[]) =>
    request(app).post('/api/v1/mealplans').set(auth(t)).send(planBody(meals));

  it('creates a plan when two meals use the same recipe', async () => {
    const res = await create(a, [meal(recipeA, 0), meal(recipeA, 1)]);
    expect(res.status).toBe(201);
    const items = await prisma.mealPlanItem.findMany({ where: { mealPlanId: res.body.id } });
    expect(items).toHaveLength(2);
  });

  it('still returns 404 when another user private recipe is referenced', async () => {
    const res = await create(a, [meal(recipeA, 0), meal(recipeB, 1)]);
    expect(res.status).toBe(404);
  });

  it('still returns 404 for a missing recipe even when repeated', async () => {
    const missing = '00000000-0000-4000-8000-000000000000';
    const res = await create(a, [meal(missing, 0), meal(missing, 1)]);
    expect(res.status).toBe(404);
  });

  it('updates a plan to repeat a recipe and keeps cookedAt on surviving meals', async () => {
    const created = await create(a, [meal(recipeA, 0), meal(recipeA2, 1)]);
    expect(created.status).toBe(201);
    const cookedAt = new Date('2026-10-12T18:00:00.000Z');
    await prisma.mealPlanItem.updateMany({
      where: { mealPlanId: created.body.id, recipeId: recipeA, dayOfWeek: 0 },
      data: { cookedAt },
    });

    const res = await request(app)
      .patch(`/api/v1/mealplans/${created.body.id}`)
      .set(auth(a))
      .send({ meals: [meal(recipeA, 0), meal(recipeA, 2), meal(recipeA2, 1)] });
    expect(res.status).toBe(200);

    const items = await prisma.mealPlanItem.findMany({ where: { mealPlanId: created.body.id } });
    expect(items).toHaveLength(3);
    const kept = items.find((i) => i.recipeId === recipeA && i.dayOfWeek === 0);
    expect(kept?.cookedAt?.toISOString()).toBe(cookedAt.toISOString());
  });

  it('rejects an update that references another user recipe', async () => {
    const created = await create(a, [meal(recipeA, 0)]);
    const res = await request(app)
      .patch(`/api/v1/mealplans/${created.body.id}`)
      .set(auth(a))
      .send({ meals: [meal(recipeA, 0), meal(recipeB, 1)] });
    expect(res.status).toBe(404);
  });
});
