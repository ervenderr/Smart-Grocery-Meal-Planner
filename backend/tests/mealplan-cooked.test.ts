/**
 * Meal plan cookedAt tests (06-08): pure carryCookedAt plus HTTP carry-forward.
 */

import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database.config';
import { carryCookedAt } from '../src/modules/mealplan/mealplan.cooked';

const T = new Date('2026-10-10T10:00:00.000Z');

describe('carryCookedAt (pure)', () => {
  it('carries a matching triple and leaves new meals null', () => {
    const prev = [{ recipeId: 'r1', dayOfWeek: 0, mealType: 'lunch', cookedAt: T }];
    const next = [
      { recipeId: 'r1', dayOfWeek: 0, mealType: 'lunch' },
      { recipeId: 'r2', dayOfWeek: 1, mealType: 'dinner' },
    ];
    expect(carryCookedAt(prev, next)).toEqual([T, null]);
  });

  it('consumes duplicates one-to-one', () => {
    const prev = [
      { recipeId: 'r1', dayOfWeek: 0, mealType: 'lunch', cookedAt: T },
      { recipeId: 'r1', dayOfWeek: 0, mealType: 'lunch', cookedAt: null },
    ];
    const next = [
      { recipeId: 'r1', dayOfWeek: 0, mealType: 'lunch' },
      { recipeId: 'r1', dayOfWeek: 0, mealType: 'lunch' },
    ];
    expect(carryCookedAt(prev, next)).toEqual([T, null]);
  });

  it('does not carry a cooked meal onto a second duplicate', () => {
    const prev = [{ recipeId: 'r1', dayOfWeek: 0, mealType: 'lunch', cookedAt: T }];
    const next = [
      { recipeId: 'r1', dayOfWeek: 0, mealType: 'lunch' },
      { recipeId: 'r1', dayOfWeek: 0, mealType: 'lunch' },
    ];
    expect(carryCookedAt(prev, next)).toEqual([T, null]);
  });

  it('returns null when the day changes', () => {
    const prev = [{ recipeId: 'r1', dayOfWeek: 0, mealType: 'lunch', cookedAt: T }];
    const next = [{ recipeId: 'r1', dayOfWeek: 2, mealType: 'lunch' }];
    expect(carryCookedAt(prev, next)).toEqual([null]);
  });

  it('does not mutate its inputs', () => {
    const prev = Object.freeze([
      Object.freeze({ recipeId: 'r1', dayOfWeek: 0, mealType: 'lunch', cookedAt: T }),
    ]);
    const next = Object.freeze([
      Object.freeze({ recipeId: 'r1', dayOfWeek: 0, mealType: 'lunch' }),
    ]);
    expect(() => carryCookedAt(prev, next)).not.toThrow();
  });

  it('handles empty inputs', () => {
    expect(carryCookedAt([], [])).toEqual([]);
  });
});

describe('Meal plan cookedAt over HTTP', () => {
  const app = createApp();
  const email = 'mealplan-cooked-test@example.com';
  let token: string;
  let userId: string;
  let r1: string;
  let r2: string;
  let planId: string;

  const recipeBody = (name: string) => ({
    name,
    description: 'd',
    category: 'dinner',
    difficulty: 'easy',
    prepTimeMinutes: 5,
    cookTimeMinutes: 5,
    servings: 2,
    ingredients: [{ ingredientName: 'rice', quantity: 1, unit: 'cups' }],
    instructions: ['Cook'],
  });

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send({ email, password: 'TestPass123', firstName: 'C', lastName: 'T' });
    token = res.body.token;
    userId = res.body.user.id;
    const a = await request(app)
      .post('/api/v1/recipes')
      .set('Authorization', `Bearer ${token}`)
      .send(recipeBody('Cooked A'));
    const b = await request(app)
      .post('/api/v1/recipes')
      .set('Authorization', `Bearer ${token}`)
      .send(recipeBody('Cooked B'));
    r1 = a.body.id;
    r2 = b.body.id;
    const plan = await request(app)
      .post('/api/v1/mealplans')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Cooked plan',
        startDate: '2026-10-12',
        endDate: '2026-10-18',
        meals: [{ recipeId: r1, dayOfWeek: 0, mealType: 'lunch', servings: 2 }],
      });
    planId = plan.body.id;
  });

  afterAll(async () => {
    await prisma.mealPlan.deleteMany({ where: { userId } });
    await prisma.recipe.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { email } });
  });

  const patchMeals = (meals: unknown[]) =>
    request(app)
      .patch(`/api/v1/mealplans/${planId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ meals });

  it('reports cookedAt null initially', async () => {
    const res = await request(app)
      .get(`/api/v1/mealplans/${planId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.meals[0].cookedAt).toBeNull();
  });

  it('keeps cookedAt when the same triple survives a meal edit', async () => {
    const item = await prisma.mealPlanItem.findFirstOrThrow({ where: { mealPlanId: planId } });
    await prisma.mealPlanItem.update({ where: { id: item.id }, data: { cookedAt: T } });

    const res = await patchMeals([
      { recipeId: r1, dayOfWeek: 0, mealType: 'lunch', servings: 3 },
      { recipeId: r2, dayOfWeek: 1, mealType: 'dinner', servings: 2 },
    ]).expect(200);

    const kept = res.body.meals.find((m: any) => m.recipeId === r1);
    const added = res.body.meals.find((m: any) => m.recipeId === r2);
    expect(new Date(kept.cookedAt).toISOString()).toBe(T.toISOString());
    expect(added.cookedAt).toBeNull();
  });

  it('drops cookedAt when the mealType changes', async () => {
    const res = await patchMeals([
      { recipeId: r1, dayOfWeek: 0, mealType: 'dinner', servings: 3 },
    ]).expect(200);
    expect(res.body.meals[0].cookedAt).toBeNull();
  });

  it('rolls back the item rebuild (and keeps cookedAt) when the update fails', async () => {
    const item = await prisma.mealPlanItem.findFirstOrThrow({ where: { mealPlanId: planId } });
    await prisma.mealPlanItem.update({ where: { id: item.id }, data: { cookedAt: T } });
    const before = await prisma.mealPlanItem.count({ where: { mealPlanId: planId } });
    // Calories overflow the Int column, so the nested create fails after the delete.
    await prisma.recipe.update({ where: { id: r2 }, data: { caloriesPerServing: 2_000_000_000 } });

    const res = await patchMeals([
      { recipeId: r2, dayOfWeek: 2, mealType: 'dinner', servings: 5 },
    ]);
    expect(res.status).toBeGreaterThanOrEqual(400);

    const after = await prisma.mealPlanItem.findMany({ where: { mealPlanId: planId } });
    expect(after).toHaveLength(before);
    const kept = after.find((m) => m.id === item.id);
    expect(kept?.cookedAt?.toISOString()).toBe(T.toISOString());
  });
});
