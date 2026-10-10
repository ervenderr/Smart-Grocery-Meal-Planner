/**
 * WR-02 / WR-03 regression: claim-conditional completion, real DB.
 */

import express from 'express';
import request from 'supertest';
import * as store from '../src/modules/idempotency/idempotency.store';
import { idempotency } from '../src/middleware/idempotency.middleware';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database.config';
import { complete, release, reserve, takeOver } from '../src/modules/idempotency/idempotency.store';

const PREFIX = `idemcl-${Date.now()}`;

describe('idempotency claim token (WR-02)', () => {
  let userId: string;

  beforeAll(async () => {
    const res = await request(createApp())
      .post('/api/v1/auth/signup')
      .send({
        email: `${PREFIX}@example.com`,
        password: 'TestPass123',
        firstName: 'Cl',
        lastName: 'Aim',
      });
    userId = res.body.user.id;
  });

  afterAll(async () => {
    await prisma.idempotencyKey.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it('ignores complete/release from an owner whose claim was taken over', async () => {
    const base = { userId, key: `${PREFIX}-key-1`, method: 'POST', route: '/r', requestHash: 'h' };
    const t0 = new Date(Date.now() - 200_000);
    const id = await reserve({ ...base, now: t0 });
    expect(id).not.toBeNull();

    const t1 = new Date();
    expect(await takeOver(id as string, t0, { ...base, now: t1 })).toBe(true);

    // Original (stale) owner finishes late: must not touch the new owner's row.
    expect(await complete(id as string, t0, 201, { stale: true })).toBe(false);
    await release(id as string, t0);
    const row = await prisma.idempotencyKey.findUnique({ where: { id: id as string } });
    expect(row?.status).toBe('in_progress');

    expect(await complete(id as string, t1, 201, { fresh: true })).toBe(true);
    const done = await prisma.idempotencyKey.findUnique({ where: { id: id as string } });
    expect(done?.status).toBe('completed');
    expect(done?.responseBody).toEqual({ fresh: true });
  });

  it('retries a transient completion failure so the key completes (WR-03)', async () => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as unknown as { user: { id: string } }).user = { id: userId };
      next();
    });
    app.use(idempotency);
    app.post('/ok', (_req, res) => res.status(201).json({ ok: true }));

    const spy = jest.spyOn(store, 'complete').mockRejectedValueOnce(new Error('db blip'));
    const key = `${PREFIX}-key-2`;
    const res = await request(app).post('/ok').set('Idempotency-Key', key).send({});
    spy.mockRestore();

    expect(res.status).toBe(201);
    const row = await prisma.idempotencyKey.findUnique({ where: { userId_key: { userId, key } } });
    expect(row?.status).toBe('completed');
  });
});
