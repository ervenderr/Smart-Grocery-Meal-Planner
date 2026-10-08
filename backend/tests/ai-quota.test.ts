/**
 * AI quota: atomic per-user and global UTC-day caps, refund on failure,
 * 429 contract, day rollover. Each test uses its own far-future UTC day.
 */

import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database.config';
import { resetAiDepsForTests, setAiDepsForTests } from '../src/modules/ai/ai.deps';
import {
  QuotaExceededError,
  nextUtcMidnight,
  refundQuota,
  reserveQuota,
  utcDay,
} from '../src/modules/ai/ai-quota.repository';
import {
  chatCompletion,
  createUserWithPantry,
  errorResponse,
  installFakeAi,
  uniqueName,
} from './helpers/ai-test-helpers';

const app = createApp();
const createdUserIds: string[] = [];
const usedDays: string[] = [];
let fetchSpy: jest.SpyInstance;

const recipeReply = (name: string): string =>
  JSON.stringify({
    recipes: [
      {
        name: 'Bowl',
        description: 'Tasty',
        difficulty: 'easy',
        prepTimeMinutes: 10,
        cookTimeMinutes: 20,
        ingredients: [{ ingredientName: name, quantity: 1, unit: 'cups' }],
        instructions: ['Mix'],
      },
    ],
  });

function useDay(day: string, limits = { userDaily: 2, globalDaily: 3 }): Date {
  usedDays.push(day);
  const at = new Date(`${day}T12:00:00Z`);
  installFakeAi();
  setAiDepsForTests({ now: () => at, limits });
  return at;
}

beforeEach(() => {
  fetchSpy = jest.spyOn(global, 'fetch');
});

afterEach(async () => {
  resetAiDepsForTests();
  for (const day of usedDays.splice(0)) {
    await prisma.$executeRaw`DELETE FROM ai_usage WHERE day = ${day}::date`;
  }
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

const suggest = (token: string, body: Record<string, unknown> = {}) =>
  request(app).post('/api/v1/ai/suggest-recipes').set('Authorization', `Bearer ${token}`).send(body);

async function count(scope: string, day: string): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ count: number }>>`
    SELECT count FROM ai_usage WHERE scope = ${scope} AND day = ${day}::date`;
  return rows[0]?.count ?? 0;
}

describe('quota over HTTP', () => {
  it('returns 429 AI_QUOTA_EXCEEDED on the 3rd call, but cache hits still work', async () => {
    const day = '2031-03-01';
    useDay(day);
    const a = uniqueName('rice');
    const { token } = await newUser([a]);
    fetchSpy.mockImplementation(async () => chatCompletion(recipeReply(a)));

    expect((await suggest(token, { maxPrepTime: 5 })).status).toBe(200);
    expect((await suggest(token, { maxPrepTime: 6 })).status).toBe(200);
    const blocked = await suggest(token, { maxPrepTime: 7 });

    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe('AI_QUOTA_EXCEEDED');
    expect(blocked.body.message).toContain('2/2');
    expect(blocked.body.message).toContain('2031-03-02T00:00:00.000Z');
    expect(blocked.body.error).toBe(blocked.body.message);
    expect(blocked.body.quota).toEqual({
      scope: 'user',
      limit: 2,
      remaining: 0,
      resetsAt: '2031-03-02T00:00:00.000Z',
    });

    const hit = await suggest(token, { maxPrepTime: 5 });
    expect(hit.status).toBe(200);
    expect(hit.body.cached).toBe(true);
  });

  it('returns 429 with scope global when the global cap is reached', async () => {
    const day = '2031-03-03';
    useDay(day, { userDaily: 10, globalDaily: 3 });
    const users = [];
    for (let i = 0; i < 4; i += 1) {
      const n = uniqueName(`g${i}`);
      users.push({ n, ...(await newUser([n])) });
    }
    fetchSpy.mockImplementation(async (_url: unknown, init: unknown) => {
      const body = JSON.parse(String((init as { body: string }).body));
      const m = /([a-z0-9]+-[0-9a-f]{8})/.exec(JSON.stringify(body.messages));
      return chatCompletion(recipeReply(m ? m[1] : 'x'));
    });

    for (const u of users.slice(0, 3)) expect((await suggest(u.token)).status).toBe(200);
    const fourth = await suggest(users[3].token);

    expect(fourth.status).toBe(429);
    expect(fourth.body.code).toBe('AI_QUOTA_EXCEEDED');
    expect(fourth.body.quota.scope).toBe('global');
  });

  it('refunds user and global counts when the provider fails', async () => {
    const day = '2031-03-04';
    useDay(day);
    const a = uniqueName('fail');
    const { token, userId } = await newUser([a]);
    fetchSpy.mockResolvedValueOnce(errorResponse(500));

    const res = await suggest(token);

    expect(res.status).toBe(503);
    expect(await count(`user:${userId}`, day)).toBe(0);
    expect(await count('global', day)).toBe(0);
  });

  it('lets the same user call again after the UTC day rolls over', async () => {
    const day = '2031-03-05';
    useDay(day, { userDaily: 1, globalDaily: 10 });
    const a = uniqueName('roll');
    const { token } = await newUser([a]);
    fetchSpy.mockImplementation(async () => chatCompletion(recipeReply(a)));

    expect((await suggest(token, { maxPrepTime: 1 })).status).toBe(200);
    expect((await suggest(token, { maxPrepTime: 2 })).status).toBe(429);

    useDay('2031-03-06', { userDaily: 1, globalDaily: 10 });
    expect((await suggest(token, { maxPrepTime: 3 })).status).toBe(200);
  });
});

describe('Repository quota', () => {
  it('concurrent reserves never exceed the user limit (30 -> 20)', async () => {
    const day = '2031-03-10';
    usedDays.push(day);
    const userId = `u-${uniqueName('c')}`;
    const results = await Promise.allSettled(
      Array.from({ length: 30 }, () => reserveQuota({ userId, day, userLimit: 20, globalLimit: 1000 }))
    );
    const ok = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(ok).toHaveLength(20);
    expect(rejected).toHaveLength(10);
    for (const r of rejected) {
      expect((r as PromiseRejectedResult).reason).toBeInstanceOf(QuotaExceededError);
    }
    expect(await count(`user:${userId}`, day)).toBe(20);
    expect(await count('global', day)).toBe(20);
  });

  it('rollback: a rejected user reserve leaves the global count unchanged', async () => {
    const day = '2031-03-11';
    usedDays.push(day);
    const userId = `u-${uniqueName('r')}`;
    await reserveQuota({ userId, day, userLimit: 1, globalLimit: 100 });
    await expect(reserveQuota({ userId, day, userLimit: 1, globalLimit: 100 })).rejects.toMatchObject({
      scope: 'user',
      limit: 1,
    });
    expect(await count('global', day)).toBe(1);
  });

  it('refundQuota decrements and never goes below zero', async () => {
    const day = '2031-03-12';
    usedDays.push(day);
    const userId = `u-${uniqueName('f')}`;
    await reserveQuota({ userId, day, userLimit: 5, globalLimit: 5 });
    await refundQuota({ userId, day });
    await refundQuota({ userId, day });
    expect(await count(`user:${userId}`, day)).toBe(0);
    expect(await count('global', day)).toBe(0);
  });

  it('utcDay and nextUtcMidnight use UTC', () => {
    const at = new Date('2031-03-13T23:59:59Z');
    expect(utcDay(at)).toBe('2031-03-13');
    expect(nextUtcMidnight(at)).toBe('2031-03-14T00:00:00.000Z');
  });
});
