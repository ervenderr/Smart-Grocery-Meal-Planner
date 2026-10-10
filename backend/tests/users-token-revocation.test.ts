/**
 * WR-05 / WR-06: password change and deactivation revoke refresh tokens
 * atomically with the user update. Real DB.
 */

import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database.config';
import * as refreshService from '../src/modules/auth/refresh-token.service';

const app = createApp();
const TAG = `usrrev-${Date.now()}`;
let counter = 0;

async function signup() {
  counter += 1;
  const email = `${TAG}-${counter}@example.com`;
  const res = await request(app).post('/api/v1/auth/signup').send({ email, password: 'TestPass123' });
  expect(res.status).toBe(201);
  return { id: res.body.user.id as string, email, token: res.body.token as string, refreshToken: res.body.refreshToken as string };
}

afterEach(() => jest.restoreAllMocks());
afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
});

const activeTokens = (userId: string) =>
  prisma.refreshToken.count({ where: { userId, revokedAt: null } });

describe('password change (WR-05)', () => {
  it('revokes refresh tokens on success', async () => {
    const u = await signup();
    await request(app)
      .patch('/api/v1/users/password')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ currentPassword: 'TestPass123', newPassword: 'NewPass456' })
      .expect(200);
    expect(await activeTokens(u.id)).toBe(0);
  });

  it('rolls back the password when revocation fails', async () => {
    const u = await signup();
    jest.spyOn(refreshService, 'revokeAllForUser').mockRejectedValueOnce(new Error('boom'));
    const res = await request(app)
      .patch('/api/v1/users/password')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ currentPassword: 'TestPass123', newPassword: 'NewPass456' });
    expect(res.status).toBeGreaterThanOrEqual(500);
    await request(app).post('/api/v1/auth/login').send({ email: u.email, password: 'TestPass123' }).expect(200);
    expect(await activeTokens(u.id)).toBeGreaterThan(0);
  });
});

describe('deactivation (WR-06)', () => {
  it('revokes refresh tokens with reason inactive', async () => {
    const u = await signup();
    await request(app)
      .delete('/api/v1/users/account')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ password: 'TestPass123' })
      .expect(200);
    expect(await activeTokens(u.id)).toBe(0);
    const row = await prisma.refreshToken.findFirst({ where: { userId: u.id } });
    expect(row?.revokedReason).toBe('inactive');
  });

  it('keeps the user active when revocation fails', async () => {
    const u = await signup();
    jest.spyOn(refreshService, 'revokeAllForUser').mockRejectedValueOnce(new Error('boom'));
    const res = await request(app)
      .delete('/api/v1/users/account')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ password: 'TestPass123' });
    expect(res.status).toBeGreaterThanOrEqual(500);
    const user = await prisma.user.findUnique({ where: { id: u.id } });
    expect(user?.isActive).toBe(true);
  });
});
