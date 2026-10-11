/**
 * Free-tier pantry limit on POST /pantry (12-07, SUB-02/SUB-03).
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database.config';
import { grantTestEntitlement, revokeTestEntitlement } from './helpers/entitlement-fixtures';

const app = createApp();
const PREFIX = `pantry-limit-${Date.now()}`;
const LIMIT = 25;

interface TestUser {
  readonly token: string;
  readonly id: string;
}

const signup = async (suffix: string): Promise<TestUser> => {
  const res = await request(app)
    .post('/api/v1/auth/signup')
    .send({ email: `${PREFIX}-${suffix}@example.com`, password: 'TestPass123', firstName: 'Lim', lastName: 'It' });
  return { token: res.body.token as string, id: res.body.user.id as string };
};

const body = (extra: object = {}) => ({
  ingredientName: 'Flour',
  quantity: 2,
  unit: 'kg',
  category: 'grains',
  ...extra,
});

const post = (u: TestUser, payload: object, headers: Record<string, string> = {}) =>
  request(app).post('/api/v1/pantry').set('Authorization', `Bearer ${u.token}`).set(headers).send(payload);

const seed = (userId: string, active: number, deleted = 0) =>
  prisma.pantryItem.createMany({
    data: [
      ...Array.from({ length: active }, (_, i) => ({
        userId,
        ingredientName: `seed-${i}`,
        quantity: 1,
        unit: 'pieces',
        category: 'other',
      })),
      ...Array.from({ length: deleted }, (_, i) => ({
        userId,
        ingredientName: `gone-${i}`,
        quantity: 1,
        unit: 'pieces',
        category: 'other',
        deletedAt: new Date(),
      })),
    ],
  });

const activeCount = (userId: string) => prisma.pantryItem.count({ where: { userId, deletedAt: null } });

describe('POST /pantry free-tier limit', () => {
  const users: TestUser[] = [];
  const newUser = async (suffix: string): Promise<TestUser> => {
    const u = await signup(suffix);
    users.push(u);
    return u;
  };

  afterAll(async () => {
    const ids = users.map((u) => u.id);
    await prisma.pantryItem.deleteMany({ where: { userId: { in: ids } } });
    await prisma.idempotencyKey.deleteMany({ where: { userId: { in: ids } } });
    await prisma.entitlement.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  });

  it('returns 403 UPGRADE_REQUIRED at the limit with details', async () => {
    const u = await newUser('at-limit');
    await seed(u.id, LIMIT);
    const res = await post(u, body()).expect(403);
    expect(res.body).toMatchObject({
      code: 'UPGRADE_REQUIRED',
      message: 'Free pantry limit reached',
      limit: LIMIT,
      current: LIMIT,
      adding: 1,
      feature: 'pantry_items',
    });
    expect(res.body.error).toBeDefined();
    expect(await activeCount(u.id)).toBe(LIMIT);
  });

  it('does not count soft-deleted rows', async () => {
    const u = await newUser('soft');
    await seed(u.id, 24, 3);
    await post(u, body()).expect(201);
    await post(u, body()).expect(403);
  });

  it('entitled users can exceed the limit; revoked users are gated again', async () => {
    const u = await newUser('entitled');
    await seed(u.id, LIMIT);
    await grantTestEntitlement(u.id);
    await post(u, body()).expect(201);
    await revokeTestEntitlement(u.id);
    await post(u, body()).expect(403);
  });

  it('replaying an existing own client id at the limit returns 200, not 403', async () => {
    const u = await newUser('replay');
    const id = randomUUID();
    await post(u, body({ id })).expect(201);
    await seed(u.id, LIMIT - 1);
    expect(await activeCount(u.id)).toBe(LIMIT);
    const res = await post(u, body({ id })).expect(200);
    expect(res.body.id).toBe(id);
  });

  it('concurrent creates cannot push past the limit', async () => {
    const u = await newUser('race');
    await seed(u.id, 23);
    const results = await Promise.all(
      Array.from({ length: 5 }, () => post(u, body({ id: randomUUID() }))),
    );
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([201, 201, 403, 403, 403]);
    expect(await activeCount(u.id)).toBe(LIMIT);
  });

  it('existing items stay editable at 26+ items for a free user', async () => {
    const u = await newUser('over');
    await seed(u.id, 26);
    const item = await prisma.pantryItem.findFirstOrThrow({ where: { userId: u.id } });
    const auth = { Authorization: `Bearer ${u.token}` };

    await request(app).patch(`/api/v1/pantry/${item.id}`).set(auth).send({ notes: 'edited' }).expect(200);
    await request(app)
      .post(`/api/v1/pantry/${item.id}/adjust`)
      .set(auth)
      .send({ delta: -0.5 })
      .expect(200);
    await request(app).delete(`/api/v1/pantry/${item.id}`).set(auth).expect(200);
  });

  it('does not cache the 403 under an Idempotency-Key', async () => {
    const u = await newUser('idem');
    await seed(u.id, LIMIT);
    const headers = { 'Idempotency-Key': `key-${randomUUID()}` };
    const payload = body({ id: randomUUID() });
    await post(u, payload, headers).expect(403);
    await grantTestEntitlement(u.id);
    await post(u, payload, headers).expect(201);
  });
});
