/**
 * Account deletion (STORE-01) integration tests.
 */

import request from 'supertest';
import express from 'express';
import { Prisma } from '@prisma/client';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database.config';
import { deleteAccountPermanently } from '../src/modules/users/account-deletion.service';
import { createAccountDeletionLimiter } from '../src/modules/users/account-deletion.limiter';
import {
  OWNED_MODEL_FACTORIES,
  OWNED_MODEL_COUNTERS,
  seedAiUsage,
  countAiUsage,
  countGlobalAiUsage,
} from './helpers/user-owned-fixtures';

const app = createApp();
const PASSWORD = 'TestPass123';
const TAG = `acctdel-${Date.now()}`;

interface TestUser {
  id: string;
  email: string;
  token: string;
}

async function signup(label: string): Promise<TestUser> {
  const email = `${TAG}-${label}@example.com`;
  const res = await request(app)
    .post('/api/v1/auth/signup')
    .send({ email, password: PASSWORD, firstName: 'Del', lastName: label });
  expect(res.status).toBe(201);
  return { id: res.body.user.id, email, token: res.body.token };
}

async function seedAll(userId: string): Promise<void> {
  for (const factory of Object.values(OWNED_MODEL_FACTORIES)) {
    await factory(userId);
  }
  await seedAiUsage(userId);
}

async function countsFor(userId: string): Promise<Record<string, number>> {
  const entries = await Promise.all(
    Object.entries(OWNED_MODEL_COUNTERS).map(
      async ([name, counter]) => [name, await counter(userId)] as const
    )
  );
  return { ...Object.fromEntries(entries), AiUsage: await countAiUsage(userId) };
}

function del(token: string, body?: Record<string, unknown>) {
  const r = request(app).delete('/api/v1/users/me').set('Authorization', `Bearer ${token}`);
  return body === undefined ? r : r.send(body);
}

describe('DELETE /api/v1/users/me', () => {
  let a: TestUser;
  let b: TestUser;

  beforeEach(async () => {
    a = await signup('a');
    b = await signup('b');
    await seedAll(a.id);
    await seedAll(b.id);
  });

  afterEach(async () => {
    await prisma.aiUsage.deleteMany({ where: { scope: { in: [`user:${a.id}`, `user:${b.id}`] } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  });

  it('deletes every row owned by A (incl. RESTRICT recipe/meal plan) and leaves B intact', async () => {
    const before = await countsFor(a.id);
    Object.values(before).forEach((n) => expect(n).toBeGreaterThan(0));

    await del(a.token, { password: PASSWORD }).expect(204);

    const afterA = await countsFor(a.id);
    Object.entries(afterA).forEach(([, n]) => expect(n).toBe(0));
    expect(await prisma.user.count({ where: { id: a.id } })).toBe(0);

    const afterB = await countsFor(b.id);
    Object.entries(afterB).forEach(([name, n]) => expect([name, n]).toEqual([name, before[name]]));
    expect(await countGlobalAiUsage()).toBeGreaterThan(0);
  });

  it('handles concurrent duplicate deletes without a 500', async () => {
    const results = await Promise.all([
      del(a.token, { password: PASSWORD }),
      del(a.token, { password: PASSWORD }),
    ]);
    const statuses = results.map((r) => r.status);
    statuses.forEach((s) => expect([204, 401, 404]).toContain(s));
    expect(statuses).toContain(204);
    expect(await prisma.user.count({ where: { id: a.id } })).toBe(0);
  });

  it('is idempotent when two deletions race past the user lookup', async () => {
    const settled = await Promise.allSettled([
      deleteAccountPermanently(a.id, PASSWORD),
      deleteAccountPermanently(a.id, PASSWORD),
      deleteAccountPermanently(a.id, PASSWORD),
    ]);
    settled.forEach((r) => {
      if (r.status === 'rejected') expect((r.reason as { statusCode?: number }).statusCode).toBe(404);
    });
    expect(settled.some((r) => r.status === 'fulfilled')).toBe(true);
    expect(await prisma.user.count({ where: { id: a.id } })).toBe(0);
  });

  it('returns 403 INVALID_PASSWORD on wrong password and deletes nothing', async () => {
    const before = await countsFor(a.id);
    const res = await del(a.token, { password: 'WrongPass999' }).expect(403);
    expect(res.body.code).toBe('INVALID_PASSWORD');
    expect(await countsFor(a.id)).toEqual(before);
    await request(app)
      .get('/api/v1/users/profile')
      .set('Authorization', `Bearer ${a.token}`)
      .expect(200);
  });

  it('returns 400 for missing or empty password', async () => {
    await del(a.token, {}).expect(400);
    await del(a.token, { password: '' }).expect(400);
  });

  it('returns 401 when unauthenticated', async () => {
    await request(app).delete('/api/v1/users/me').send({ password: PASSWORD }).expect(401);
  });

  it('invalidates the old token and credentials after deletion', async () => {
    await del(a.token, { password: PASSWORD }).expect(204);
    await request(app)
      .get('/api/v1/users/profile')
      .set('Authorization', `Bearer ${a.token}`)
      .expect(401);
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: a.email, password: PASSWORD })
      .expect(401);
  });
});

describe('deletion fixture completeness (Prisma DMMF)', () => {
  it('has a factory and counter for every model related to User', () => {
    const userOwned = Prisma.dmmf.datamodel.models
      .filter((m) => m.fields.some((f) => f.kind === 'object' && f.type === 'User'))
      .map((m) => m.name);
    expect(userOwned.length).toBeGreaterThan(0);
    for (const name of userOwned) {
      if (!OWNED_MODEL_FACTORIES[name]) {
        throw new Error(`No deletion fixture for model ${name}`);
      }
      if (!OWNED_MODEL_COUNTERS[name]) {
        throw new Error(`No deletion counter for model ${name}`);
      }
    }
  });
});

describe('account deletion limiter', () => {
  it('returns 429 ACCOUNT_DELETE_RATE_LIMITED after the failed-attempt limit', async () => {
    const limited = express();
    limited.use(express.json());
    limited.delete('/x', createAccountDeletionLimiter(2), (req, res) => {
      res.status(req.body.ok ? 204 : 403).send();
    });
    await request(limited).delete('/x').send({ ok: false }).expect(403);
    await request(limited).delete('/x').send({ ok: false }).expect(403);
    const res = await request(limited).delete('/x').send({ ok: false }).expect(429);
    expect(res.body.code).toBe('ACCOUNT_DELETE_RATE_LIMITED');
  });
});
