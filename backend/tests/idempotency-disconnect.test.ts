/**
 * CR-01 regression: a client disconnect mid-request must not release the
 * idempotency reservation; the retry must replay, not re-run the handler.
 */

import http from 'node:http';
import { AddressInfo } from 'node:net';
import express from 'express';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database.config';
import { idempotency } from '../src/middleware/idempotency.middleware';

const PREFIX = `idemdc-${Date.now()}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('idempotency client disconnect (CR-01)', () => {
  let userId: string;
  let applied = 0;
  let server: http.Server;
  let port: number;

  beforeAll(async () => {
    const res = await request(createApp())
      .post('/api/v1/auth/signup')
      .send({
        email: `${PREFIX}@example.com`,
        password: 'TestPass123',
        firstName: 'Dis',
        lastName: 'Connect',
      });
    userId = res.body.user.id;

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as unknown as { user: { id: string } }).user = { id: userId };
      next();
    });
    app.use(idempotency);
    app.post('/slow', async (_req, res) => {
      await sleep(400);
      applied += 1;
      res.status(201).json({ applied });
    });
    server = app.listen(0);
    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    server.close();
    await prisma.idempotencyKey.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it('keeps the reservation, completes after disconnect, and replays on retry', async () => {
    const key = `${PREFIX}-key-1`;
    const req = http.request({
      port,
      method: 'POST',
      path: '/slow',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
    });
    req.on('error', () => undefined);
    req.end('{}');
    await sleep(100);
    req.destroy();

    // Retry while the original handler is still running: must not run twice.
    const during = await request(`http://127.0.0.1:${port}`)
      .post('/slow')
      .set('Idempotency-Key', key)
      .send({});
    expect(during.status).toBe(409);
    expect(applied).toBe(0);

    await sleep(600);
    const row = await prisma.idempotencyKey.findUnique({
      where: { userId_key: { userId, key } },
    });
    expect(row?.status).toBe('completed');
    expect(applied).toBe(1);

    const retry = await request(`http://127.0.0.1:${port}`)
      .post('/slow')
      .set('Idempotency-Key', key)
      .send({});
    expect(retry.status).toBe(201);
    expect(retry.headers['idempotency-replayed']).toBe('true');
    expect(applied).toBe(1);
  });
});
