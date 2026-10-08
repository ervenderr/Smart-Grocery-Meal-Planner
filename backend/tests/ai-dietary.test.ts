/**
 * Diet enforcement: saved prefs UNION request restrictions are applied in code
 * after the provider call, and restriction text never reaches the provider.
 */

import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database.config';
import { resetAiDepsForTests } from '../src/modules/ai/ai.deps';
import {
  chatCompletion,
  createUserWithPantry,
  installFakeAi,
  uniqueName,
} from './helpers/ai-test-helpers';

const app = createApp();
const createdUserIds: string[] = [];

const recipe = (name: string, ingredient: string) => ({
  name,
  description: 'Tasty',
  difficulty: 'easy',
  prepTimeMinutes: 10,
  cookTimeMinutes: 20,
  ingredients: [{ ingredientName: ingredient, quantity: 1, unit: 'cups' }],
  instructions: ['Mix', 'Cook'],
});

const mealJson = (meals: unknown[]): string =>
  JSON.stringify({ name: 'Plan', meals, estimatedCostCents: 1000, totalCalories: 2000 });

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
  await prisma.userPreference.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.pantryItem.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

async function newUser(names: string[]) {
  const user = await createUserWithPantry(app, names);
  createdUserIds.push(user.userId);
  return user;
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const RESTRICTION_WORDS = ['vegan', 'gluten', 'dairy', 'halal', 'allergy'];

function expectNoRestrictionText(): void {
  for (const call of fetchSpy.mock.calls) {
    const sent = String(call[1].body).toLowerCase();
    for (const word of RESTRICTION_WORDS) expect(sent).not.toContain(word);
  }
}

describe('request restrictions', () => {
  it('removes violating recipes and reports filteredOut', async () => {
    const item = uniqueName('block');
    const { token } = await newUser([item]);
    fetchSpy.mockResolvedValueOnce(
      chatCompletion(JSON.stringify({ recipes: [recipe('Tofu Bowl', 'tofu'), recipe('Chicken Pot', 'chicken')] }))
    );

    const res = await request(app)
      .post('/api/v1/ai/suggest-recipes')
      .set(auth(token))
      .send({ dietaryRestrictions: ['vegan'] });

    expect(res.status).toBe(200);
    expect(res.body.suggestions.map((s: { name: string }) => s.name)).toEqual(['Tofu Bowl']);
    expect(res.body.filteredOut).toBe(1);
    expectNoRestrictionText();
  });

  it('removes a substitution whose substitute violates dairy-free', async () => {
    const { token } = await newUser([]);
    const oil = uniqueName('oil');
    fetchSpy.mockResolvedValueOnce(
      chatCompletion(
        JSON.stringify({
          substitutions: [
            { original: oil, substitute: 'butter', reason: 'r', estimatedSavingsPercent: 10 },
            { original: oil, substitute: 'canola oil', reason: 'r', estimatedSavingsPercent: 20 },
          ],
        })
      )
    );

    const res = await request(app)
      .post('/api/v1/ai/suggest-substitutions')
      .set(auth(token))
      .send({
        ingredients: [{ ingredientName: oil, quantity: 1, unit: 'kg' }],
        dietaryRestrictions: ['dairy-free'],
      });

    expect(res.status).toBe(200);
    expect(res.body.suggestions.map((s: { substitute: string }) => s.substitute)).toEqual(['canola oil']);
    expect(res.body.filteredOut).toBe(1);
    expectNoRestrictionText();
  });

  it('returns an empty list with filteredOut equal to the count when all violate', async () => {
    const { token } = await newUser([uniqueName('x')]);
    fetchSpy.mockResolvedValueOnce(
      chatCompletion(JSON.stringify({ recipes: [recipe('Beef Stew', 'beef'), recipe('Pork Chop', 'pork')] }))
    );

    const res = await request(app)
      .post('/api/v1/ai/suggest-recipes')
      .set(auth(token))
      .send({ dietaryRestrictions: ['vegetarian'] });

    expect(res.status).toBe(200);
    expect(res.body.suggestions).toEqual([]);
    expect(res.body.filteredOut).toBe(2);
  });
});

describe('saved preferences', () => {
  it('removes meals violating saved gluten-free prefs without request restrictions', async () => {
    const { token, userId } = await newUser([uniqueName('rice')]);
    await prisma.userPreference.upsert({
      where: { userId },
      create: { userId, dietaryRestrictions: ['gluten-free'] },
      update: { dietaryRestrictions: ['gluten-free'] },
    });
    fetchSpy.mockResolvedValueOnce(
      chatCompletion(
        mealJson([
          { day: 0, mealType: 'dinner', recipeName: 'Pasta Night', ingredients: ['pasta', 'sauce'] },
          { day: 1, mealType: 'dinner', recipeName: 'Rice Bowl', ingredients: ['rice'] },
        ])
      )
    );

    const res = await request(app)
      .post('/api/v1/ai/generate-meal-plan')
      .set(auth(token))
      .send({ budgetCents: uniqueBudget() });

    expect(res.status).toBe(200);
    expect(res.body.mealPlan.meals.map((m: { recipeName: string }) => m.recipeName)).toEqual(['Rice Bowl']);
    expect(res.body.filteredOut).toBe(1);
    expectNoRestrictionText();
  });

  it('unions saved prefs with request restrictions for recipes', async () => {
    const { token, userId } = await newUser([uniqueName('bean')]);
    await prisma.userPreference.upsert({
      where: { userId },
      create: { userId, dietaryRestrictions: ['dairy-free'] },
      update: { dietaryRestrictions: ['dairy-free'] },
    });
    fetchSpy.mockResolvedValueOnce(
      chatCompletion(
        JSON.stringify({
          recipes: [recipe('Cheese Bake', 'cheese'), recipe('Fish Pie', 'fish'), recipe('Bean Chili', 'beans')],
        })
      )
    );

    const res = await request(app)
      .post('/api/v1/ai/suggest-recipes')
      .set(auth(token))
      .send({ dietaryRestrictions: ['pescatarian'] });

    expect(res.status).toBe(200);
    const names = res.body.suggestions.map((s: { name: string }) => s.name);
    expect(names).toEqual(['Fish Pie', 'Bean Chili']);
    expect(res.body.filteredOut).toBe(1);
    expectNoRestrictionText();
  });
});

describe('data minimization for meal plans', () => {
  it('never sends request restrictions to the provider', async () => {
    const { token } = await newUser([uniqueName('corn')]);
    fetchSpy.mockResolvedValueOnce(
      chatCompletion(mealJson([{ day: 0, mealType: 'lunch', recipeName: 'Corn Soup', ingredients: ['corn'] }]))
    );

    const res = await request(app)
      .post('/api/v1/ai/generate-meal-plan')
      .set(auth(token))
      .send({ budgetCents: uniqueBudget(), dietaryRestrictions: ['vegan', 'halal', 'peanut allergy'] });

    expect(res.status).toBe(200);
    expectNoRestrictionText();
  });
});
