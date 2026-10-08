/**
 * Meal plan generation through the validated provider pipeline.
 * The provider is mocked via a fetch spy; no real network calls.
 */

import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database.config';
import { resetAiDepsForTests } from '../src/modules/ai/ai.deps';
import {
  chatCompletion,
  createUserWithPantry,
  errorResponse,
  installFakeAi,
  uniqueName,
} from './helpers/ai-test-helpers';

const app = createApp();
const createdUserIds: string[] = [];

type Meal = Record<string, unknown>;

const meal = (day: unknown, mealType: unknown, recipeName: string, ingredients: string[]): Meal => ({
  day,
  mealType,
  recipeName,
  ingredients,
});

const plan = (meals: Meal[], extra: Record<string, unknown> = {}): string =>
  JSON.stringify({ name: 'Week Plan', meals, estimatedCostCents: 4000, totalCalories: 12000, ...extra });

const uniqueBudget = (): number => 5000 + Math.floor(Math.random() * 90000);

let fetchSpy: jest.SpyInstance;

beforeEach(() => {
  fetchSpy = jest.spyOn(global, 'fetch');
  installFakeAi();
});

afterEach(() => {
  resetAiDepsForTests();
});

afterAll(async () => {
  await prisma.pantryItem.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

async function newUser(names: string[]) {
  const user = await createUserWithPantry(app, names);
  createdUserIds.push(user.userId);
  return user;
}

const generate = (token: string, body: Record<string, unknown>) =>
  request(app).post('/api/v1/ai/generate-meal-plan').set('Authorization', `Bearer ${token}`).send(body);

describe('POST /api/v1/ai/generate-meal-plan', () => {
  it('parses a <think> reply and keeps the mealPlan response shape', async () => {
    const item = uniqueName('rice');
    const { token } = await newUser([item]);
    const reply =
      '<think>planning the week</think>\n' +
      plan([meal(0, 'breakfast', 'Rice Porridge', [item]), meal('6', 'dinner', 'Veg Stir Fry', ['carrot'])]);
    fetchSpy.mockResolvedValueOnce(chatCompletion(reply));

    const res = await generate(token, { daysCount: 7, budgetCents: uniqueBudget() });

    expect(res.status).toBe(200);
    expect(res.body.pantryItemsUsed).toBe(1);
    expect(res.body.mealPlan).toEqual(
      expect.objectContaining({
        name: 'Week Plan',
        estimatedCostCents: 4000,
        totalCalories: 12000,
      })
    );
    expect(res.body.mealPlan.meals).toHaveLength(2);
    expect(res.body.mealPlan.meals[1].day).toBe(6);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('accepts a 14-day plan with days up to 13 and more than 60 meals', async () => {
    const { token } = await newUser([uniqueName('lentil')]);
    const meals: Meal[] = [];
    for (let d = 0; d < 14; d++) {
      for (const t of ['breakfast', 'lunch', 'dinner', 'snack']) meals.push(meal(d, t, `Dish ${d}${t}`, ['x']));
    }
    fetchSpy.mockResolvedValueOnce(chatCompletion(plan(meals)));

    const res = await generate(token, { daysCount: 14, budgetCents: uniqueBudget() });

    expect(res.status).toBe(200);
    expect(res.body.mealPlan.meals).toHaveLength(56);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('rejects meals whose day is beyond the requested daysCount', async () => {
    const { token } = await newUser([uniqueName('bean')]);
    const bad = plan([meal(5, 'lunch', 'Late', ['x'])]);
    fetchSpy.mockResolvedValueOnce(chatCompletion(bad)).mockResolvedValueOnce(chatCompletion(bad));

    const res = await generate(token, { daysCount: 3, budgetCents: uniqueBudget() });

    expect(res.status).toBe(503);
  });

  it('repairs once when day is outside 0..6 or mealType is invalid', async () => {
    const { token } = await newUser([uniqueName('oat')]);
    fetchSpy
      .mockResolvedValueOnce(chatCompletion(plan([meal(9, 'brunch', 'Bad', ['x'])])))
      .mockResolvedValueOnce(chatCompletion(plan([meal(1, 'lunch', 'Good', ['x'])])));

    const res = await generate(token, { budgetCents: uniqueBudget() });

    expect(res.status).toBe(200);
    expect(res.body.mealPlan.meals[0].mealType).toBe('lunch');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('returns 503 AI_UNAVAILABLE when output is invalid twice', async () => {
    const { token } = await newUser([uniqueName('kale')]);
    const bad = plan([meal(9, 'brunch', 'Bad', ['x'])]);
    fetchSpy.mockResolvedValueOnce(chatCompletion(bad)).mockResolvedValueOnce(chatCompletion(bad));

    const res = await generate(token, { budgetCents: uniqueBudget() });

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('AI_UNAVAILABLE');
    expect(fetchSpy.mock.calls.length).toBeLessThanOrEqual(2);
  });

  it('maps provider 429 to 503 AI_UNAVAILABLE', async () => {
    const { token } = await newUser([uniqueName('pea')]);
    fetchSpy.mockResolvedValueOnce(errorResponse(429));

    const res = await generate(token, { budgetCents: uniqueBudget() });

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('AI_UNAVAILABLE');
  });

  it('wraps pantry data in <pantry_data>', async () => {
    const name = uniqueName('tomato');
    const { token } = await newUser([name]);
    fetchSpy.mockResolvedValueOnce(chatCompletion(plan([meal(0, 'lunch', 'Soup', [name])])));

    const res = await generate(token, { budgetCents: uniqueBudget() });

    expect(res.status).toBe(200);
    const sent = fetchSpy.mock.calls[0][1].body as string;
    expect(sent).toContain('<pantry_data>');
    expect(sent).toContain(name);
  });
});
