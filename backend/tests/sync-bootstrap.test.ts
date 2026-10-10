/**
 * GET /api/v1/sync/bootstrap (real DB).
 */

import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database.config';
import { toRecipeResponse } from '../src/modules/recipe/recipe.format';

const app = createApp();
const PREFIX = 'sync-bootstrap-test';
const URL = '/api/v1/sync/bootstrap';

interface Actor { token: string; id: string }

async function signup(tag: string): Promise<Actor> {
  const res = await request(app).post('/api/v1/auth/signup').send({
    email: `${PREFIX}-${tag}@example.com`,
    password: 'TestPass123',
    firstName: 'Sync',
    lastName: tag,
  });
  return { token: res.body.token, id: res.body.user.id };
}

const get = (token: string, query: Record<string, unknown> = {}) =>
  request(app).get(URL).query(query).set('Authorization', `Bearer ${token}`);

async function seed(userId: string): Promise<{ pantryIds: string[]; recipeIds: string[]; planIds: string[] }> {
  const rows = Array.from({ length: 130 }, (_, i) => ({
    userId,
    ingredientName: `item-${i}`,
    quantity: i < 2 ? 0 : 1 + i,
    unit: 'pieces',
    category: 'other',
    deletedAt: i >= 127 ? new Date() : null,
  }));
  await prisma.pantryItem.createMany({ data: rows });
  const pantry = await prisma.pantryItem.findMany({ where: { userId, deletedAt: null } });
  const recipeIds: string[] = [];
  for (let i = 0; i < 5; i++) {
    const r = await prisma.recipe.create({
      data: {
        userId, title: `r${i}`, category: 'dinner', difficulty: 'easy',
        ingredientsList: [{ name: 'x', quantity: 1, unit: 'pieces' }],
        instructions: ['go'],
      },
    });
    recipeIds.push(r.id);
  }
  await prisma.recipe.create({
    data: { userId, title: 'gone', category: 'dinner', difficulty: 'easy', ingredientsList: [], instructions: [], deletedAt: new Date() },
  });
  const planIds: string[] = [];
  for (let i = 0; i < 2; i++) {
    const p = await prisma.mealPlan.create({
      data: {
        userId, name: `plan${i}`, startDate: new Date('2026-01-05'), endDate: new Date('2026-01-11'),
        mealPlanItems: { create: [{ recipeId: recipeIds[0], dayOfWeek: 0, mealType: 'dinner' }] },
      },
    });
    planIds.push(p.id);
  }
  return { pantryIds: pantry.map((p) => p.id), recipeIds, planIds };
}

async function walk(token: string, limit: number) {
  const pages: any[] = [];
  let cursor: string | undefined;
  do {
    const res = await get(token, { limit, ...(cursor && { cursor }) });
    expect(res.status).toBe(200);
    pages.push(res.body);
    cursor = res.body.nextCursor ?? undefined;
  } while (cursor && pages.length < 50);
  return pages;
}

describe('GET /api/v1/sync/bootstrap', () => {
  let a: Actor;
  let b: Actor;
  let seeded: Awaited<ReturnType<typeof seed>>;

  beforeAll(async () => {
    a = await signup('a');
    b = await signup('b');
    seeded = await seed(a.id);
    await prisma.pantryItem.create({
      data: { userId: b.id, ingredientName: 'other-user', quantity: 1, unit: 'pieces', category: 'other' },
    });
  });

  afterAll(async () => {
    const users = await prisma.user.findMany({ where: { email: { contains: PREFIX } }, select: { id: true } });
    const ids = users.map((u) => u.id);
    await prisma.mealPlan.deleteMany({ where: { userId: { in: ids } } });
    await prisma.recipe.deleteMany({ where: { userId: { in: ids } } });
    await prisma.pantryItem.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  });

  it('requires auth', async () => {
    expect((await request(app).get(URL)).status).toBe(401);
  });

  it('first page has serverTime, shoppingList, pantry section', async () => {
    const res = await get(a.token, { limit: 50 });
    expect(res.status).toBe(200);
    expect(new Date(res.body.serverTime).toISOString()).toBe(res.body.serverTime);
    expect(res.body.section).toBe('pantry');
    expect(res.body.items).toHaveLength(50);
    expect(typeof res.body.nextCursor).toBe('string');
    const list = await request(app).get('/api/v1/shopping/list').set('Authorization', `Bearer ${a.token}`);
    expect(res.body.shoppingList.id).toBe(list.body.id);
    expect(Object.keys(res.body.shoppingList).sort()).toEqual(Object.keys(list.body).sort());
  });

  it('walks pantry, recipes, meal plans without gaps or duplicates', async () => {
    const pages = await walk(a.token, 50);
    const bySection = (s: string) => pages.filter((p) => p.section === s).flatMap((p) => p.items.map((i: any) => i.id));
    const pantry = bySection('pantry');
    expect(pantry).toHaveLength(127);
    expect(new Set(pantry).size).toBe(127);
    expect([...pantry].sort()).toEqual([...seeded.pantryIds].sort());
    expect(bySection('recipes').sort()).toEqual([...seeded.recipeIds].sort());
    expect(bySection('mealPlans').sort()).toEqual([...seeded.planIds].sort());
    expect(pages[pages.length - 1].nextCursor).toBeNull();
    expect(pages.every((p) => typeof p.serverTime === 'string')).toBe(true);
    expect(pages.filter((p) => p.shoppingList).length).toBe(1);
    expect(pages[0].shoppingList).toBeDefined();
    // order and no mixing
    const order = pages.map((p) => p.section);
    expect(order).toEqual([...order].sort((x, y) => ['pantry', 'recipes', 'mealPlans'].indexOf(x) - ['pantry', 'recipes', 'mealPlans'].indexOf(y)));
    const zero = pages.filter((p) => p.section === 'pantry').flatMap((p) => p.items).filter((i: any) => i.quantity === '0' || Number(i.quantity) === 0);
    expect(zero).toHaveLength(2);
  });

  it('exhausted section points at the next section start', async () => {
    const res = await get(a.token, { limit: 200 });
    expect(res.body.items).toHaveLength(127);
    const decoded = JSON.parse(Buffer.from(res.body.nextCursor, 'base64url').toString());
    expect(decoded).toEqual({ s: 'recipes', after: null });
  });

  it('recipe and meal plan items match list formatters', async () => {
    const pages = await walk(a.token, 200);
    const recipes = pages.find((p) => p.section === 'recipes').items;
    const dbRecipes = await prisma.recipe.findMany({ where: { id: { in: seeded.recipeIds } }, orderBy: { id: 'asc' } });
    expect(recipes).toEqual(JSON.parse(JSON.stringify(dbRecipes.map(toRecipeResponse))));
    const plans = pages.find((p) => p.section === 'mealPlans').items;
    const listRes = await request(app).get('/api/v1/mealplans').set('Authorization', `Bearer ${a.token}`);
    const listed = new Map<string, unknown>(listRes.body.items.map((i: any) => [i.id, i]));
    expect(plans).toHaveLength(2);
    for (const p of plans) expect(p).toEqual(listed.get(p.id));
  });

  it('isolates users', async () => {
    const pages = await walk(b.token, 200);
    const all = pages.flatMap((p) => p.items);
    expect(all).toHaveLength(1);
    expect(all[0].ingredientName).toBe('other-user');
  });

  it('rejects bad cursor and limit', async () => {
    const bad = await get(a.token, { cursor: 'garbage!' });
    expect(bad.status).toBe(400);
    expect(bad.body.code).toBe('SYNC_CURSOR_INVALID');
    const lim = await get(a.token, { limit: 500 });
    expect(lim.status).toBe(400);
    expect(lim.body.code).toBe('VALIDATION_ERROR');
  });

  it('ignores another user id inside a cursor', async () => {
    const forged = Buffer.from(JSON.stringify({ s: 'pantry', after: seeded.pantryIds[0] })).toString('base64url');
    const res = await get(b.token, { cursor: forged });
    expect(res.status).toBe(200);
    expect(res.body.items.every((i: any) => i.userId === b.id)).toBe(true);
  });
});
