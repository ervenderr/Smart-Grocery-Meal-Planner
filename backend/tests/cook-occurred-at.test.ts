/**
 * Optional occurredAt on POST /cook/apply (Phase 11 offline queued cook, additive).
 */

import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database.config';

const app = createApp();
const PREFIX = `cookocc-${Date.now()}`;
const DAY_MS = 24 * 60 * 60 * 1000;

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
      lastName: 'Occurred',
    });
  return { token: res.body.token, id: res.body.user.id };
};

const createRecipe = async (t: TestUser): Promise<string> => {
  const res = await request(app)
    .post('/api/v1/recipes')
    .set(auth(t))
    .send({
      name: 'Occurred cook',
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

const createPlanItem = async (t: TestUser, recipeId: string): Promise<string> => {
  const plan = await prisma.mealPlan.create({
    data: {
      userId: t.id,
      name: 'Occurred plan',
      startDate: new Date('2026-10-12T00:00:00.000Z'),
      endDate: new Date('2026-10-18T00:00:00.000Z'),
      mealPlanItems: { create: [{ recipeId, dayOfWeek: 0, mealType: 'dinner', servings: 2 }] },
    },
    include: { mealPlanItems: true },
  });
  return plan.mealPlanItems[0].id;
};

const apply = (t: TestUser, body: object, key?: string) => {
  const req = request(app).post('/api/v1/cook/apply').set(auth(t));
  if (key) req.set('Idempotency-Key', key);
  return req.send(body);
};

const cookedAtOf = async (itemId: string): Promise<Date> => {
  const item = await prisma.mealPlanItem.findUniqueOrThrow({ where: { id: itemId } });
  if (!item.cookedAt) throw new Error('cookedAt not set');
  return item.cookedAt;
};

describe('POST /cook/apply occurredAt', () => {
  let user: TestUser;
  let recipeId: string;

  beforeAll(async () => {
    user = await signup('a');
    recipeId = await createRecipe(user);
  });

  afterAll(async () => {
    await prisma.mealPlan.deleteMany({ where: { userId: user.id } });
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  });

  it('records the given occurredAt as cookedAt', async () => {
    const itemId = await createPlanItem(user, recipeId);
    const when = new Date(Date.now() - 2 * 60 * 60 * 1000);
    await apply(user, { mealPlanItemId: itemId, deductions: [], occurredAt: when.toISOString() }).expect(200);
    const cookedAt = await cookedAtOf(itemId);
    expect(Math.abs(cookedAt.getTime() - when.getTime())).toBeLessThan(1000);
  });

  it('clamps an occurredAt older than 14 days', async () => {
    const itemId = await createPlanItem(user, recipeId);
    const old = new Date(Date.now() - 30 * DAY_MS);
    await apply(user, { mealPlanItemId: itemId, deductions: [], occurredAt: old.toISOString() }).expect(200);
    const cookedAt = await cookedAtOf(itemId);
    const floor = Date.now() - 14 * DAY_MS;
    expect(Math.abs(cookedAt.getTime() - floor)).toBeLessThan(10_000);
  });

  it('clamps a future occurredAt to now', async () => {
    const itemId = await createPlanItem(user, recipeId);
    const future = new Date(Date.now() + 5 * DAY_MS);
    await apply(user, { mealPlanItemId: itemId, deductions: [], occurredAt: future.toISOString() }).expect(200);
    const cookedAt = await cookedAtOf(itemId);
    expect(cookedAt.getTime()).toBeLessThanOrEqual(Date.now());
    expect(cookedAt.getTime()).toBeGreaterThan(Date.now() - 10_000);
  });

  it('uses server time when occurredAt is absent', async () => {
    const itemId = await createPlanItem(user, recipeId);
    await apply(user, { mealPlanItemId: itemId, deductions: [] }).expect(200);
    const cookedAt = await cookedAtOf(itemId);
    expect(Math.abs(cookedAt.getTime() - Date.now())).toBeLessThan(5000);
  });

  it('rejects an invalid occurredAt with VALIDATION_ERROR', async () => {
    const itemId = await createPlanItem(user, recipeId);
    const res = await apply(user, {
      mealPlanItemId: itemId,
      deductions: [],
      occurredAt: 'not-a-date',
    }).expect(400);
    expect(res.body.code ?? res.body.error?.code).toBe('VALIDATION_ERROR');
  });

  it('accepts occurredAt on a recipe target without a meal marker', async () => {
    await apply(user, {
      recipeId,
      deductions: [],
      occurredAt: new Date(Date.now() - 60_000).toISOString(),
    }).expect(200);
  });

  it('replays an idempotent request without changing cookedAt', async () => {
    const itemId = await createPlanItem(user, recipeId);
    const key = `${PREFIX}-key-${Date.now()}`;
    const body = {
      mealPlanItemId: itemId,
      deductions: [],
      occurredAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    };
    const first = await apply(user, body, key).expect(200);
    const firstCookedAt = await cookedAtOf(itemId);
    const second = await apply(user, body, key).expect(200);
    expect(second.body).toEqual(first.body);
    expect((await cookedAtOf(itemId)).getTime()).toBe(firstCookedAt.getTime());
  });
});
