/**
 * Client-generated ids on POST /pantry (08-09, SYNC-03).
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database.config';

const app = createApp();
const PREFIX = 'pantry-cid';

describe('POST /pantry with client id', () => {
  let tokenA: string;
  let userA: string;
  let tokenB: string;
  let userB: string;

  const signup = async (suffix: string) => {
    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send({ email: `${PREFIX}-${suffix}@example.com`, password: 'TestPass123', firstName: 'Cid', lastName: 'Test' });
    return { token: res.body.token as string, id: res.body.user.id as string };
  };

  const body = (extra: object = {}) => ({
    ingredientName: 'Flour',
    quantity: 2,
    unit: 'kg',
    category: 'grains',
    ...extra,
  });

  const post = (payload: object, token = tokenA) =>
    request(app).post('/api/v1/pantry').set('Authorization', `Bearer ${token}`).send(payload);

  beforeAll(async () => {
    const a = await signup('a');
    const b = await signup('b');
    tokenA = a.token;
    userA = a.id;
    tokenB = b.token;
    userB = b.id;
  });

  afterAll(async () => {
    await prisma.pantryItem.deleteMany({ where: { userId: { in: [userA, userB] } } });
    await prisma.user.deleteMany({ where: { email: { contains: `${PREFIX}-` } } });
  });

  it('creates with the client id (201)', async () => {
    const id = randomUUID();
    const res = await post(body({ id })).expect(201);
    expect(res.body.id).toBe(id);
  });

  it('retry returns the original row with 200, unchanged', async () => {
    const id = randomUUID();
    await post(body({ id })).expect(201);
    const res = await post(body({ id, quantity: 9, ingredientName: 'Changed' })).expect(200);
    expect(res.body.id).toBe(id);
    expect(res.body.ingredientName).toBe('Flour');
    expect(res.body.quantity).toBe('2');
    expect(await prisma.pantryItem.count({ where: { id } })).toBe(1);
  });

  it('409 CLIENT_ID_CONFLICT for another user id, without leaking data', async () => {
    const id = randomUUID();
    await post(body({ id, ingredientName: 'SecretStash' }), tokenB).expect(201);
    const res = await post(body({ id })).expect(409);
    expect(JSON.stringify(res.body)).not.toContain('SecretStash');
    expect(res.body.code ?? res.body.error?.code).toBe('CLIENT_ID_CONFLICT');
  });

  it('410 CLIENT_ID_DELETED for own soft-deleted row, row untouched', async () => {
    const id = randomUUID();
    await post(body({ id })).expect(201);
    await prisma.pantryItem.update({ where: { id }, data: { deletedAt: new Date() } });
    const res = await post(body({ id, quantity: 7 })).expect(410);
    expect(res.body.code ?? res.body.error?.code).toBe('CLIENT_ID_DELETED');
    const row = await prisma.pantryItem.findUniqueOrThrow({ where: { id } });
    expect(row.deletedAt).not.toBeNull();
    expect(row.quantity.toString()).toBe('2');
  });

  it('400 for a non-UUID id; server id when omitted', async () => {
    await post(body({ id: 'not-a-uuid' })).expect(400);
    const res = await post(body()).expect(201);
    expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('concurrent duplicate creates yield one row (201 and 200)', async () => {
    const id = randomUUID();
    const [r1, r2] = await Promise.all([post(body({ id })), post(body({ id }))]);
    expect([r1.status, r2.status].sort()).toEqual([200, 201]);
    expect(await prisma.pantryItem.count({ where: { id } })).toBe(1);
  });
});
