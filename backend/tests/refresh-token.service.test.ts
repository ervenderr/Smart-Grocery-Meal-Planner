/**
 * Refresh-token service tests (SYNC-04) against the real DB.
 */

import { prisma } from '../src/config/database.config';
import { config } from '../src/config/env.config';
import {
  hashRefreshToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeFamilyByToken,
  revokeAllForUser,
} from '../src/modules/auth/refresh-token.service';

const TAG = `rtsvc-${Date.now()}`;
const createdIds: string[] = [];

async function makeUser(label: string, isActive = true): Promise<string> {
  const user = await prisma.user.create({
    data: { email: `${TAG}-${label}@example.com`, passwordHash: 'x', isActive },
  });
  createdIds.push(user.id);
  return user.id;
}

async function expectCode(p: Promise<unknown>, code: string): Promise<void> {
  await expect(p).rejects.toMatchObject({ statusCode: 401, code });
}

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: createdIds } } });
});

describe('refresh-token.service', () => {
  it('issues a 43-char token stored only as sha256 hash', async () => {
    const userId = await makeUser('issue');
    const issued = await issueRefreshToken(userId);
    expect(issued.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const days = (issued.refreshExpiresAt.getTime() - Date.now()) / 86_400_000;
    expect(Math.round(days)).toBe(config.refreshToken.ttlDays);
    const rows = await prisma.refreshToken.findMany({ where: { userId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).toBe(hashRefreshToken(issued.refreshToken));
    expect(JSON.stringify(rows[0])).not.toContain(issued.refreshToken);
  });

  it('rotates an active token within the same family', async () => {
    const userId = await makeUser('rotate');
    const a = await issueRefreshToken(userId);
    const b = await rotateRefreshToken(a.refreshToken);
    expect(b.userId).toBe(userId);
    expect(b.refreshToken).not.toBe(a.refreshToken);
    const old = await prisma.refreshToken.findUnique({ where: { tokenHash: hashRefreshToken(a.refreshToken) } });
    expect(old?.revokedReason).toBe('rotated');
    const fresh = await prisma.refreshToken.findUnique({ where: { tokenHash: hashRefreshToken(b.refreshToken) } });
    expect(fresh?.familyId).toBe(a.familyId);
    expect(fresh?.revokedAt).toBeNull();
  });

  it('answers a replay within the grace window with a fresh successor', async () => {
    const userId = await makeUser('grace');
    const a = await issueRefreshToken(userId);
    await rotateRefreshToken(a.refreshToken);
    const again = await rotateRefreshToken(a.refreshToken);
    expect(again.refreshToken).toBeTruthy();
    const active = await prisma.refreshToken.count({ where: { familyId: a.familyId, revokedAt: null } });
    expect(active).toBe(2);
  });

  it('revokes the family when a rotated token is replayed after the grace window', async () => {
    const userId = await makeUser('reuse');
    const a = await issueRefreshToken(userId);
    const b = await rotateRefreshToken(a.refreshToken);
    const past = new Date(Date.now() - (config.refreshToken.reuseGraceSeconds + 30) * 1000);
    await prisma.refreshToken.update({
      where: { tokenHash: hashRefreshToken(a.refreshToken) },
      data: { revokedAt: past },
    });
    await expectCode(rotateRefreshToken(a.refreshToken), 'REFRESH_TOKEN_REUSED');
    const active = await prisma.refreshToken.count({ where: { familyId: a.familyId, revokedAt: null } });
    expect(active).toBe(0);
    await expectCode(rotateRefreshToken(b.refreshToken), 'REFRESH_TOKEN_INVALID');
  });

  it('rejects unknown and expired tokens uniformly', async () => {
    const userId = await makeUser('invalid');
    await expectCode(rotateRefreshToken('A'.repeat(43)), 'REFRESH_TOKEN_INVALID');
    const a = await issueRefreshToken(userId);
    await prisma.refreshToken.update({
      where: { tokenHash: hashRefreshToken(a.refreshToken) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await expectCode(rotateRefreshToken(a.refreshToken), 'REFRESH_TOKEN_INVALID');
  });

  it('rejects tokens revoked by logout or password change', async () => {
    const userId = await makeUser('revoked');
    const a = await issueRefreshToken(userId);
    await revokeFamilyByToken(a.refreshToken, 'logout');
    await expectCode(rotateRefreshToken(a.refreshToken), 'REFRESH_TOKEN_INVALID');
    const b = await issueRefreshToken(userId);
    await revokeAllForUser(userId, 'password_change');
    await expectCode(rotateRefreshToken(b.refreshToken), 'REFRESH_TOKEN_INVALID');
  });

  it('revokes the family for an inactive user', async () => {
    const userId = await makeUser('inactive', false);
    const a = await issueRefreshToken(userId);
    await expectCode(rotateRefreshToken(a.refreshToken), 'REFRESH_TOKEN_INVALID');
    const row = await prisma.refreshToken.findUnique({ where: { tokenHash: hashRefreshToken(a.refreshToken) } });
    expect(row?.revokedReason).toBe('inactive');
  });

  it('handles concurrent rotations without family revocation', async () => {
    const userId = await makeUser('concurrent');
    const a = await issueRefreshToken(userId);
    const results = await Promise.all([rotateRefreshToken(a.refreshToken), rotateRefreshToken(a.refreshToken)]);
    expect(results[0].refreshToken).not.toBe(results[1].refreshToken);
    const reused = await prisma.refreshToken.count({ where: { familyId: a.familyId, revokedReason: 'reuse' } });
    expect(reused).toBe(0);
    const active = await prisma.refreshToken.count({ where: { familyId: a.familyId, revokedAt: null } });
    expect(active).toBe(2);
  });

  it('revokeFamilyByToken ignores unknown tokens; revokeAllForUser is user scoped', async () => {
    const u1 = await makeUser('scope1');
    const u2 = await makeUser('scope2');
    await expect(revokeFamilyByToken('Z'.repeat(43), 'logout')).resolves.toBeUndefined();
    await issueRefreshToken(u1);
    await issueRefreshToken(u2);
    await revokeAllForUser(u1, 'password_change');
    expect(await prisma.refreshToken.count({ where: { userId: u1, revokedAt: null } })).toBe(0);
    expect(await prisma.refreshToken.count({ where: { userId: u2, revokedAt: null } })).toBe(1);
  });
});
