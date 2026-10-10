/**
 * /auth/refresh, /auth/logout and revocation hooks (SYNC-04), real DB.
 */

import request from 'supertest';
import express from 'express';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database.config';
import { config } from '../src/config/env.config';
import { refreshLimiter } from '../src/middleware/rateLimiter';

const app = createApp();
const PASSWORD = 'TestPass123';
const TAG = `authrefresh-${Date.now()}`;
let counter = 0;

interface Session {
  id: string;
  email: string;
  token: string;
  refreshToken: string;
}

async function signup(): Promise<Session> {
  counter += 1;
  const email = `${TAG}-${counter}@example.com`;
  const res = await request(app).post('/api/v1/auth/signup').send({ email, password: PASSWORD });
  expect(res.status).toBe(201);
  return { id: res.body.user.id, email, token: res.body.token, refreshToken: res.body.refreshToken };
}

const refresh = (body: unknown) => request(app).post('/api/v1/auth/refresh').send(body as object);

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
});

describe('login/signup response', () => {
  it('adds refresh fields and uses the configured TTL', async () => {
    const s = await signup();
    const login = await request(app).post('/api/v1/auth/login').send({ email: s.email, password: PASSWORD }).expect(200);
    expect(login.body.expiresIn).toBe(config.jwt.expiresIn);
    expect(login.body.token).toEqual(expect.any(String));
    expect(login.body.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(new Date(login.body.refreshExpiresAt).getTime()).toBeGreaterThan(Date.now());
  });
});

describe('POST /auth/refresh', () => {
  it('rotates and returns a working access token', async () => {
    const s = await signup();
    const res = await refresh({ refreshToken: s.refreshToken }).expect(200);
    expect(Object.keys(res.body).sort()).toEqual(['expiresIn', 'refreshExpiresAt', 'refreshToken', 'token']);
    expect(res.body.refreshToken).not.toBe(s.refreshToken);
    expect(res.body.expiresIn).toBe(config.jwt.expiresIn);
    await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${res.body.token}`).expect(200);
  });

  it('rejects malformed bodies with 400', async () => {
    await refresh({}).expect(400);
    await refresh({ refreshToken: 'short' }).expect(400);
    await refresh({ refreshToken: 'a'.repeat(43) + '!' }).expect(400);
    await refresh({ refreshToken: 'a'.repeat(43), extra: 1 }).expect(400);
  });

  it('rejects unknown tokens with a uniform 401', async () => {
    const res = await refresh({ refreshToken: 'B'.repeat(43) }).expect(401);
    expect(res.body.message).toBe('Invalid or expired refresh token');
  });

  it('mounts refreshLimiter on /refresh and /logout', async () => {
    const stack = (await import('../src/modules/auth/auth.routes')).default.stack as Array<{
      route?: { path: string; stack: Array<{ handle: unknown }> };
    }>;
    for (const path of ['/refresh', '/logout']) {
      const layer = stack.find((l) => l.route?.path === path);
      expect(layer?.route?.stack.some((h) => h.handle === refreshLimiter)).toBe(true);
    }
  });

  it('refreshLimiter answers 429 AUTH_REFRESH_RATE_LIMITED shape', async () => {
    // Fresh module instance so the app-wide limiter store is not consumed.
    let freshLimiter!: typeof refreshLimiter;
    jest.isolateModules(() => {
      freshLimiter = require('../src/middleware/rateLimiter').refreshLimiter;
    });
    const limited = express();
    limited.use(express.json());
    limited.post('/x', freshLimiter, (_req, res) => res.status(401).json({}));
    let last = 0;
    let code = '';
    for (let i = 0; i < 31; i += 1) {
      const r = await request(limited).post('/x').send({});
      last = r.status;
      code = r.body.code;
    }
    expect(last).toBe(429);
    expect(code).toBe('AUTH_REFRESH_RATE_LIMITED');
  });
});

describe('POST /auth/logout', () => {
  it('revokes the refresh family without an Authorization header', async () => {
    const s = await signup();
    await request(app).post('/api/v1/auth/logout').send({ refreshToken: s.refreshToken }).expect(200);
    await refresh({ refreshToken: s.refreshToken }).expect(401);
  });

  it('returns 200 with no body or an unknown token', async () => {
    await request(app).post('/api/v1/auth/logout').expect(200);
    await request(app).post('/api/v1/auth/logout').send({ refreshToken: 'C'.repeat(43) }).expect(200);
  });

  it('rejects a malformed logout body with 400', async () => {
    await request(app).post('/api/v1/auth/logout').send({ refreshToken: 'x' }).expect(400);
  });
});

describe('revocation hooks', () => {
  it('password change revokes every refresh token', async () => {
    const s = await signup();
    const second = await request(app).post('/api/v1/auth/login').send({ email: s.email, password: PASSWORD }).expect(200);
    await request(app)
      .patch('/api/v1/users/password')
      .set('Authorization', `Bearer ${s.token}`)
      .send({ currentPassword: PASSWORD, newPassword: 'NewPass456' })
      .expect(200);
    await refresh({ refreshToken: s.refreshToken }).expect(401);
    await refresh({ refreshToken: second.body.refreshToken }).expect(401);
  });

  it('account deletion removes refresh token rows', async () => {
    const s = await signup();
    expect(await prisma.refreshToken.count({ where: { userId: s.id } })).toBeGreaterThan(0);
    await request(app)
      .delete('/api/v1/users/me')
      .set('Authorization', `Bearer ${s.token}`)
      .send({ password: PASSWORD })
      .expect(204);
    expect(await prisma.refreshToken.count({ where: { userId: s.id } })).toBe(0);
  });
});
