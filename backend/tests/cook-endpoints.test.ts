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

describe('POST /api/v1/cook/apply', () => {
  let a: TestUser;
  let b: TestUser;
  let recipeId: string;

  beforeAll(async () => {
    a = await signup('apply-a');
    b = await signup('apply-b');
    recipeId = await createRecipe(a, [{ ingredientName: 'eggs', quantity: 4, unit: 'pieces' }]);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  });

  const keyFor = async (t: TestUser, ing: Ingredient, id = recipeId): Promise<string> => {
    const recipe = await prisma.recipe.findUniqueOrThrow({ where: { id } });
    await prisma.recipe.update({ where: { id }, data: { ingredientsList: [ing] } });
    const res = await preview(t, { recipeId: id }).expect(200);
    await prisma.recipe.update({ where: { id }, data: { ingredientsList: recipe.ingredientsList as object } });
    return res.body.rows[0].key as string;
  };

  it('requires authentication', async () => {
    await apply(null, { recipeId, deductions: [] }).expect(401);
  });

  it('deducts the confirmed amount', async () => {
    const lot = await addLot(a, 'Eggs', 12, 'pieces');
    const key = await keyFor(a, { ingredientName: 'eggs', quantity: 4, unit: 'pieces' });
    const res = await apply(a, { recipeId, deductions: [{ key, unit: 'pieces', use: 4 }] }).expect(200);
    expect(res.body).toEqual({ updated: 1, usedUp: 0, skipped: 0 });
    expect(await qtyOf(lot)).toBe(8);
    const get = await request(app).get(`/api/v1/pantry/${lot}`).set(auth(a));
    expect(get.status).toBe(200);
  });

  it('does not lose a deduction when two applies race on the same lot', async () => {
    const lot = await addLot(a, 'Flour', 12, 'pieces');
    const key = await keyFor(a, { ingredientName: 'flour', quantity: 3, unit: 'pieces' });
    const body = { recipeId, deductions: [{ key, unit: 'pieces', use: 3 }] };
    const [r1, r2] = await Promise.all([apply(a, body), apply(a, body)]);
    expect([r1.status, r2.status]).toEqual([200, 200]);
    expect(await qtyOf(lot)).toBe(6);
  });

  it('floors at zero and keeps the row', async () => {
    const lot = await addLot(a, 'Bananas', 8, 'pieces');
    const key = await keyFor(a, { ingredientName: 'bananas', quantity: 1, unit: 'pieces' });
    const res = await apply(a, { recipeId, deductions: [{ key, unit: 'pieces', use: 50 }] }).expect(200);
    expect(res.body).toEqual({ updated: 1, usedUp: 1, skipped: 0 });
    expect(await qtyOf(lot)).toBe(0);
    const get = await request(app).get(`/api/v1/pantry/${lot}`).set(auth(a)).expect(200);
    expect(Number(get.body.quantity ?? get.body.item?.quantity)).toBe(0);
  });

  it('deducts first-expiring lots first across lots', async () => {
    const later = await addLot(a, 'Rice', 1, 'kg', FUTURE);
    const sooner = await addLot(a, 'Rice', 500, 'grams', SOON);
    const key = await keyFor(a, { ingredientName: 'rice', quantity: 700, unit: 'grams' });
    const res = await apply(a, { recipeId, deductions: [{ key, unit: 'grams', use: 700 }] }).expect(200);
    expect(res.body).toEqual({ updated: 2, usedUp: 1, skipped: 0 });
    expect(await qtyOf(sooner)).toBe(0);
    expect(await qtyOf(later)).toBe(0.8);
  });

  it('skips keys with no usable lots and still applies the others', async () => {
    const lot = await addLot(a, 'Pasta', 500, 'grams');
    const key = await keyFor(a, { ingredientName: 'pasta', quantity: 100, unit: 'grams' });
    const res = await apply(a, {
      recipeId,
      deductions: [
        { key: 'ghost|mass', unit: 'grams', use: 5 },
        { key, unit: 'grams', use: 100 },
      ],
    }).expect(200);
    expect(res.body).toEqual({ updated: 1, usedUp: 0, skipped: 1 });
    expect(await qtyOf(lot)).toBe(400);
  });

  it('rejects a unit from another family and changes nothing', async () => {
    const lot = await addLot(a, 'Lentils', 500, 'grams');
    const other = await addLot(a, 'Barley', 500, 'grams');
    const lentils = await keyFor(a, { ingredientName: 'lentils', quantity: 100, unit: 'grams' });
    const barley = await keyFor(a, { ingredientName: 'barley', quantity: 100, unit: 'grams' });
    const res = await apply(a, {
      recipeId,
      deductions: [
        { key: barley, unit: 'grams', use: 100 },
        { key: lentils, unit: 'pieces', use: 1 },
      ],
    }).expect(400);
    expect(res.body.code).toBe('DEDUCTION_UNIT_MISMATCH');
    expect(await qtyOf(lot)).toBe(500);
    expect(await qtyOf(other)).toBe(500);
  });

  it('never touches another user lots or expired lots', async () => {
    const foreign = await addLot(b, 'Quinoa', 500, 'grams');
    const expired = await addLot(a, 'Quinoa', 500, 'grams', PAST);
    const mine = await addLot(a, 'Quinoa', 300, 'grams');
    const key = await keyFor(a, { ingredientName: 'quinoa', quantity: 100, unit: 'grams' });
    await apply(a, { recipeId, deductions: [{ key, unit: 'grams', use: 1000 }] }).expect(200);
    expect(await qtyOf(foreign)).toBe(500);
    expect(await qtyOf(expired)).toBe(500);
    expect(await qtyOf(mine)).toBe(0);
  });

  it('accepts an empty deduction list', async () => {
    const res = await apply(a, { recipeId, deductions: [] }).expect(200);
    expect(res.body).toEqual({ updated: 0, usedUp: 0, skipped: 0 });
  });

  it('writes nothing for a zero use', async () => {
    const lot = await addLot(a, 'Millet', 50, 'grams');
    const key = await keyFor(a, { ingredientName: 'millet', quantity: 10, unit: 'grams' });
    const res = await apply(a, { recipeId, deductions: [{ key, unit: 'grams', use: 0 }] }).expect(200);
    expect(res.body).toEqual({ updated: 0, usedUp: 0, skipped: 0 });
    expect(await qtyOf(lot)).toBe(50);
  });

  it('rejects duplicate keys, too many deductions and negative use', async () => {
    const d = { key: 'x|mass', unit: 'grams', use: 1 };
    await apply(a, { recipeId, deductions: [d, d] }).expect(400);
    await apply(a, {
      recipeId,
      deductions: Array.from({ length: 101 }, (_v, i) => ({ ...d, key: `k${i}|mass` })),
    }).expect(400);
    await apply(a, { recipeId, deductions: [{ ...d, use: -1 }] }).expect(400);
    await apply(a, { recipeId }).expect(400);
  });

  it('returns 404 for hidden and soft-deleted recipes', async () => {
    const hidden = await apply(b, { recipeId, deductions: [] }).expect(404);
    expect(hidden.body.code).toBe('RECIPE_NOT_FOUND');
    const id = await createRecipe(a, [{ ingredientName: 'eggs', quantity: 1, unit: 'pieces' }]);
    await prisma.recipe.update({ where: { id }, data: { deletedAt: new Date() } });
    const gone = await apply(a, { recipeId: id, deductions: [] }).expect(404);
    expect(gone.body.code).toBe('RECIPE_NOT_FOUND');
  });
});
