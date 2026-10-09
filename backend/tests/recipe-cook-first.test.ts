/**
 * GET /api/v1/recipes/cook-first (phase 05-08)
 */

import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database.config';
import { RECIPE_READ_CAP, isReadCapped } from '../src/modules/intelligence/cook-first.service';

const app = createApp();
const PREFIX = `cook-first-${Date.now()}`;
const TODAY = '2026-10-10';
const day = (n: number) => new Date(Date.UTC(2026, 9, 10 + n));

interface TestUser {
  readonly token: string;
  readonly id: string;
}
const auth = (t: TestUser) => ({ Authorization: `Bearer ${t.token}` });

const signup = async (suffix: string): Promise<TestUser> => {
  const res = await request(app)
    .post('/api/v1/auth/signup')
    .send({ email: `${PREFIX}-${suffix}@example.com`, password: 'TestPass123', firstName: 'Cook', lastName: 'First' });
  return { token: res.body.token, id: res.body.user.id };
};

const createRecipe = async (t: TestUser, name: string, names: string[]): Promise<string> => {
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
  await prisma.recipe.update({
    where: { id },
    data: { ingredientsList: names.map((n) => ({ ingredientName: n, quantity: 1, unit: 'cup' })) },
  });
  return id;
};

const addPantry = (userId: string, ingredientName: string, expiryDate: Date | null) =>
  prisma.pantryItem.create({
    data: { userId, ingredientName, quantity: 1, unit: 'pieces', category: 'other', expiryDate } as never,
  });

const get = (t: TestUser | null, qs = '') => {
  const r = request(app).get(`/api/v1/recipes/cook-first${qs}`);
  return t ? r.set(auth(t)) : r;
};
const names = (res: request.Response) => res.body.items.map((i: { recipe: { name: string } }) => i.recipe.name);

describe('GET /api/v1/recipes/cook-first', () => {
  let user: TestUser;
  let other: TestUser;
  let ids: Record<string, string>;

  beforeAll(async () => {
    user = await signup('a');
    other = await signup('b');
    ids = {
      A: await createRecipe(user, 'A', ['spinach']),
      B: await createRecipe(user, 'B', ['milk']),
      C: await createRecipe(user, 'C', ['rice']),
      D: await createRecipe(user, 'D', ['spinach', 'milk']),
    };
    const gone = await createRecipe(user, 'Gone', ['spinach']);
    await prisma.recipe.update({ where: { id: gone }, data: { deletedAt: new Date() } });
    const bad = await createRecipe(user, 'Bad', []);
    await prisma.recipe.update({ where: { id: bad }, data: { ingredientsList: 'oops' as never } });
    const bad2 = await createRecipe(user, 'Bad2', []);
    await prisma.recipe.update({ where: { id: bad2 }, data: { ingredientsList: [null, 3, { ingredientName: 5 }] as never } });
    await addPantry(user.id, 'Spinach', day(1));
    await addPantry(user.id, 'Milk', day(5));
    await addPantry(user.id, 'Old Cheese', day(-2));
    await addPantry(other.id, 'Rice', day(0));
    await createRecipe(other, 'Theirs', ['spinach']);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  });

  it('ranks by expiring usage (default limit 3)', async () => {
    const res = await get(user, `?today=${TODAY}`);
    expect(res.status).toBe(200);
    expect(names(res)).toEqual(['D', 'A', 'B']);
    expect(res.body.expiringCount).toBe(2);
    expect(res.body.recipesCapped).toBe(false);
    expect(res.body.items[0]).toMatchObject({ score: 6, coveragePercent: 100 });
    expect(res.body.items[0].usesExpiring).toEqual([
      { name: 'spinach', daysLeft: 1 },
      { name: 'milk', daysLeft: 5 },
    ]);
  });

  it('applies limit, includeAll and ignores limit with includeAll', async () => {
    expect(names(await get(user, `?today=${TODAY}&limit=1`))).toEqual(['D']);
    const all = await get(user, `?today=${TODAY}&includeAll=true`);
    // Zero-score recipes (C and the malformed ones) follow the ranked ones.
    expect(names(all).slice(0, 3)).toEqual(['D', 'A', 'B']);
    expect(names(all)).toContain('C');
    const ignored = await get(user, `?today=${TODAY}&includeAll=true&limit=1`);
    expect(names(ignored)).toEqual(names(all));
  });

  it('shifts daysLeft with today and excludes expired items', async () => {
    const res = await get(user, '?today=2026-10-11');
    const d = res.body.items.find((i: { recipe: { name: string } }) => i.recipe.name === 'D');
    expect(d.usesExpiring[0]).toEqual({ name: 'spinach', daysLeft: 0 });
    expect(JSON.stringify(res.body)).not.toContain('cheese');
  });

  it('never leaks soft-deleted recipes or other users data', async () => {
    const all = await get(user, `?today=${TODAY}&includeAll=true`);
    expect(names(all)).not.toContain('Gone');
    expect(names(all)).not.toContain('Theirs');
    const c = all.body.items.find((i: { recipe: { name: string } }) => i.recipe.name === 'C');
    expect(c.score).toBe(0);
    expect(all.body.items.some((i: { recipe: { id: string } }) => i.recipe.id === ids.C)).toBe(true);
  });

  it('skips malformed ingredient lists without a 500', async () => {
    const res = await get(user, `?today=${TODAY}&includeAll=true`);
    expect(res.status).toBe(200);
  });

  it('is not shadowed by /:id', async () => {
    expect((await get(user)).status).toBe(200);
    const byId = await request(app).get(`/api/v1/recipes/${ids.A}`).set(auth(user));
    expect(byId.status).toBe(200);
  });

  it.each([
    'limit=0',
    'limit=201',
    'limit=abc',
    'today=2026-13-01',
    'today=2021-02-30',
    'today=2021-W01-1',
    'today=20261001',
    'today=2026-1-05',
    'today=2026-01-05T00:00',
    'includeAll=maybe',
  ])('rejects %s with 400', async (qs) => {
    const res = await get(user, `?${qs}`);
    expect(res.status).toBe(400);
  });

  it('accepts a leap day', async () => {
    expect((await get(user, '?today=2024-02-29')).status).toBe(200);
  });

  it('requires auth', async () => {
    expect((await get(null)).status).toBe(401);
  });
});

describe('isReadCapped (WR-03)', () => {
  it('is true only when the read hit the cap', () => {
    expect(isReadCapped(RECIPE_READ_CAP - 1, RECIPE_READ_CAP)).toBe(false);
    expect(isReadCapped(RECIPE_READ_CAP, RECIPE_READ_CAP)).toBe(true);
  });
});
