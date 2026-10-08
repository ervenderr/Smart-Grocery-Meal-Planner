/**
 * AI cache: repeat requests are free, keys are canonical and versioned,
 * failed generations are never cached, expired rows are ignored.
 */

import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database.config';
import { resetAiDepsForTests, setAiDepsForTests } from '../src/modules/ai/ai.deps';
import { buildCacheKey } from '../src/modules/ai/ai-cache-key';
import { getCached, setCached } from '../src/modules/ai/ai-cache.repository';
import {
  chatCompletion,
  createUserWithPantry,
  errorResponse,
  installFakeAi,
  uniqueName,
} from './helpers/ai-test-helpers';

const app = createApp();
const createdUserIds: string[] = [];
const createdKeys: string[] = [];
let fetchSpy: jest.SpyInstance;

const recipe = (name: string, ingredients: string[]) => ({
  name,
  description: 'Tasty',
  difficulty: 'easy',
  prepTimeMinutes: 10,
  cookTimeMinutes: 20,
  ingredients: ingredients.map((n) => ({ ingredientName: n, quantity: 1, unit: 'cups' })),
  instructions: ['Mix', 'Cook'],
});
const reply = (names: string[]): string =>
  JSON.stringify({ recipes: [recipe('Bowl', [names[0], 'salt'])] });

beforeEach(() => {
  fetchSpy = jest.spyOn(global, 'fetch');
  installFakeAi();
  // Unique far-future day so ai_usage rows never collide with other files.
  setAiDepsForTests({ now: () => new Date('2031-04-01T12:00:00Z') });
});

afterEach(async () => {
  resetAiDepsForTests();
  await prisma.$executeRaw`DELETE FROM ai_usage WHERE day = '2031-04-01'::date`;
});

afterAll(async () => {
  await prisma.aiCache.deleteMany({ where: { key: { in: createdKeys } } });
  await prisma.pantryItem.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

async function newUser(names: string[]) {
  const user = await createUserWithPantry(app, names);
  createdUserIds.push(user.userId);
  return user;
}

const suggest = (token: string, body: Record<string, unknown> = {}) =>
  request(app).post('/api/v1/ai/suggest-recipes').set('Authorization', `Bearer ${token}`).send(body);

async function userCount(userId: string): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ count: number }>>`
    SELECT count FROM ai_usage WHERE scope = ${'user:' + userId} AND day = '2031-04-01'::date`;
  return rows[0]?.count ?? 0;
}

describe('buildCacheKey', () => {
  it('ignores key order, case and whitespace; returns 64 hex chars', () => {
    const a = buildCacheKey('recipes', 1, { x: ['Rice  Bowl'], y: { b: 1, a: 2 } });
    const b = buildCacheKey('recipes', 1, { y: { a: 2, b: 1 }, x: [' rice bowl '] });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes when feature or schemaVersion changes', () => {
    const base = buildCacheKey('recipes', 1, { a: 1 });
    expect(buildCacheKey('meal_plan', 1, { a: 1 })).not.toBe(base);
    expect(buildCacheKey('recipes', 2, { a: 1 })).not.toBe(base);
  });
});

describe('cache repository', () => {
  it('ignores an expired row and replaces it on set', async () => {
    const key = buildCacheKey('recipes', 1, { n: uniqueName('exp') });
    createdKeys.push(key);
    const now = new Date('2031-04-01T12:00:00Z');
    await prisma.aiCache.create({
      data: {
        key,
        feature: 'recipes',
        schemaVersion: 1,
        payload: { old: true },
        expiresAt: new Date('2031-03-01T00:00:00Z'),
      },
    });
    expect(await getCached(key, now)).toBeNull();
    await setCached({ key, feature: 'recipes', schemaVersion: 1, payload: { fresh: true }, ttlMs: 60000, now });
    expect(await getCached(key, now)).toEqual({ fresh: true });
  });
});

describe('suggest-recipes caching', () => {
  it('serves an identical repeat from cache with one provider call and one quota use', async () => {
    const a = uniqueName('rice');
    const { token, userId } = await newUser([a]);
    fetchSpy.mockResolvedValueOnce(chatCompletion(reply([a])));

    const first = await suggest(token);
    const second = await suggest(token);

    expect(first.status).toBe(200);
    expect(first.body.cached).toBe(false);
    expect(second.status).toBe(200);
    expect(second.body.cached).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(await userCount(userId)).toBe(1);
  });

  it('shares one cached payload between users with the same pantry names', async () => {
    const a = uniqueName('lentil');
    const u1 = await newUser([a]);
    const u2 = await newUser([a]);
    fetchSpy.mockResolvedValueOnce(chatCompletion(reply([a])));

    const r1 = await suggest(u1.token);
    const r2 = await suggest(u2.token);

    expect(r1.status).toBe(200);
    expect(r2.body.cached).toBe(true);
    expect(r2.body.suggestions[0].matchPercentage).toBe(50);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(await userCount(u2.userId)).toBe(0);
  });

  it('misses when maxPrepTime differs', async () => {
    const a = uniqueName('oat');
    const { token } = await newUser([a]);
    fetchSpy.mockImplementation(async () => chatCompletion(reply([a])));

    await suggest(token, { maxPrepTime: 15 });
    await suggest(token, { maxPrepTime: 30 });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('caches nothing after an invalid reply, and a later valid request calls the provider', async () => {
    const a = uniqueName('kale');
    const { token } = await newUser([a]);
    fetchSpy
      .mockResolvedValueOnce(chatCompletion('not json'))
      .mockResolvedValueOnce(chatCompletion('still not json'));

    const bad = await suggest(token);
    expect(bad.status).toBe(503);

    fetchSpy.mockResolvedValueOnce(chatCompletion(reply([a])));
    const good = await suggest(token);
    expect(good.status).toBe(200);
    expect(good.body.cached).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it('does not cache a provider 500', async () => {
    const a = uniqueName('pea');
    const { token } = await newUser([a]);
    fetchSpy.mockResolvedValueOnce(errorResponse(500));
    expect((await suggest(token)).status).toBe(503);
    fetchSpy.mockResolvedValueOnce(chatCompletion(reply([a])));
    expect((await suggest(token)).body.cached).toBe(false);
  });
});

describe('cache DB failures degrade to a miss (WR-01)', () => {
  it('still generates and returns recipes when cache read and write throw', async () => {
    const a = uniqueName('rice');
    const { token } = await newUser([a]);
    jest.spyOn(prisma.aiCache, 'findUnique').mockRejectedValue(new Error('db down'));
    jest.spyOn(prisma.aiCache, 'upsert').mockRejectedValue(new Error('db down'));
    fetchSpy.mockResolvedValueOnce(chatCompletion(reply([a])));

    const res = await suggest(token);

    expect(res.status).toBe(200);
    expect(res.body.cached).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe('refresh and empty results (WR-12)', () => {
  it('refresh bypasses the cached result, consumes quota and replaces the cache', async () => {
    const a = uniqueName('quinoa');
    const { token, userId } = await newUser([a]);
    fetchSpy
      .mockResolvedValueOnce(chatCompletion(reply([a])))
      .mockResolvedValueOnce(chatCompletion(JSON.stringify({ recipes: [recipe('Fresh Bowl', [a])] })));

    await suggest(token);
    const fresh = await suggest(token, { refresh: true });
    const after = await suggest(token);

    expect(fresh.body.cached).toBe(false);
    expect(fresh.body.suggestions[0].name).toBe('Fresh Bowl');
    expect(after.body.cached).toBe(true);
    expect(after.body.suggestions[0].name).toBe('Fresh Bowl');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(await userCount(userId)).toBe(2);
  });

  it('does not cache an empty substitution list', async () => {
    const { token } = await newUser([]);
    const name = uniqueName('sage');
    fetchSpy
      .mockResolvedValueOnce(chatCompletion(JSON.stringify({ substitutions: [] })))
      .mockResolvedValueOnce(chatCompletion(JSON.stringify({ substitutions: [] })));
    const call = () =>
      request(app)
        .post('/api/v1/ai/suggest-substitutions')
        .set('Authorization', `Bearer ${token}`)
        .send({ ingredients: [{ ingredientName: name, quantity: 1, unit: 'cups' }] });

    const first = await call();
    const second = await call();

    expect(first.body.cached).toBe(false);
    expect(second.body.cached).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});

describe('numeric and boolean string coercion (WR-11)', () => {
  it('applies maxPrepTime "30" to the prompt and treats usePantry "false" as false', async () => {
    const { token } = await newUser([uniqueName('pea')]);
    fetchSpy.mockResolvedValueOnce(chatCompletion(reply(['x'])));

    const res = await suggest(token, { maxPrepTime: '30', usePantry: 'false', refresh: 'true' });

    expect(res.status).toBe(200);
    expect(res.body.pantryItemsUsed).toBe(0);
    const sent = fetchSpy.mock.calls[0][1].body as string;
    expect(sent).toContain('Maximum prep time: 30 minutes.');
    expect(sent).not.toContain('No prep time limit.');
  });

  it('applies budgetCents "5000" to the substitution prompt', async () => {
    const { token } = await newUser([]);
    fetchSpy.mockResolvedValueOnce(
      chatCompletion(
        JSON.stringify({
          substitutions: [{ original: 'a', substitute: 'b', reason: 'r', estimatedSavingsPercent: 10 }],
        })
      )
    );

    const res = await request(app)
      .post('/api/v1/ai/suggest-substitutions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        ingredients: [{ ingredientName: uniqueName('oil'), quantity: '2', unit: 'cups' }],
        budgetCents: '5000',
      });

    expect(res.status).toBe(200);
    const sent = fetchSpy.mock.calls[0][1].body as string;
    expect(sent).toContain('Budget: 50.00 PHP.');
  });
});
