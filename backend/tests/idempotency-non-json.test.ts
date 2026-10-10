/**
 * IN-05 regression: replies not sent via res.json (204/send/end) must not leave
 * the idempotency key in_progress.
 */

import express from 'express';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database.config';
import { idempotency } from '../src/middleware/idempotency.middleware';

const PREFIX = `idemnj-${Date.now()}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('idempotency non-json responses (IN-05)', () => {
  let userId: string;
  let runs = 0;
  const app = express();

  beforeAll(async () => {
    const res = await request(createApp())
      .post('/api/v1/auth/signup')
      .send({ email: `${PREFIX}@example.com`, password: 'TestPass123', firstName: 'Non', lastName: 'Json' });
    userId = res.body.user.id;
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as unknown as { user: { id: string } }).user = { id: userId };
      next();
    });
    app.use(idempotency);
    app.post('/nocontent', (_req, res) => {
      runs += 1;
      res.status(204).send();
    });
  });

  afterAll(async () => {
    await prisma.idempotencyKey.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it('releases the claim after a 204 send so a retry re-executes instead of 409 IN_FLIGHT', async () => {
    const key = `${PREFIX}-key-1`;
    await request(app).post('/nocontent').set('Idempotency-Key', key).send({}).expect(204);
    await sleep(100);
    expect(await prisma.idempotencyKey.count({ where: { userId, status: 'in_progress' } })).toBe(0);
    await request(app).post('/nocontent').set('Idempotency-Key', key).send({}).expect(204);
    expect(runs).toBe(2);
  });
});
