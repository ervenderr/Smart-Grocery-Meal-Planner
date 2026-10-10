/**
 * WR-04: absolute family lifetime and per-user active-family cap, real DB.
 */

import { prisma } from '../src/config/database.config';
import {
  MAX_ACTIVE_FAMILIES_PER_USER,
  MAX_FAMILY_DAYS,
  issueRefreshToken,
  rotateRefreshToken,
} from '../src/modules/auth/refresh-token.service';

const TAG = `rtlim-${Date.now()}`;
const DAY = 86_400_000;
const ids: string[] = [];

async function makeUser(label: string): Promise<string> {
  const user = await prisma.user.create({
    data: { email: `${TAG}-${label}@example.com`, passwordHash: 'x' },
  });
  ids.push(user.id);
  return user.id;
}

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
});

describe('refresh token family limits (WR-04)', () => {
  it('caps a rotated successor at the family absolute lifetime', async () => {
    const userId = await makeUser('cap');
    const a = await issueRefreshToken(userId);
    const started = new Date(Date.now() - (MAX_FAMILY_DAYS - 1) * DAY);
    await prisma.refreshToken.updateMany({
      where: { userId },
      data: { createdAt: started, expiresAt: new Date(Date.now() + 30 * DAY) },
    });
    const next = await rotateRefreshToken(a.refreshToken);
    expect(next.refreshExpiresAt.getTime()).toBeLessThanOrEqual(started.getTime() + MAX_FAMILY_DAYS * DAY);
    expect(next.refreshExpiresAt.getTime()).toBeLessThan(Date.now() + 2 * DAY);
  });

  it('rejects rotation once the family exceeded its absolute lifetime', async () => {
    const userId = await makeUser('old');
    const a = await issueRefreshToken(userId);
    await prisma.refreshToken.updateMany({
      where: { userId },
      data: {
        createdAt: new Date(Date.now() - (MAX_FAMILY_DAYS + 1) * DAY),
        expiresAt: new Date(Date.now() + 30 * DAY),
      },
    });
    await expect(rotateRefreshToken(a.refreshToken)).rejects.toMatchObject({ statusCode: 401 });
  });

  it('revokes the oldest families beyond the per-user cap', async () => {
    const userId = await makeUser('fam');
    const first = await issueRefreshToken(userId);
    await new Promise((r) => setTimeout(r, 5));
    for (let i = 0; i < MAX_ACTIVE_FAMILIES_PER_USER; i += 1) {
      await issueRefreshToken(userId);
      await new Promise((r) => setTimeout(r, 5));
    }
    const active = await prisma.refreshToken.findMany({ where: { userId, revokedAt: null } });
    expect(new Set(active.map((r) => r.familyId)).size).toBe(MAX_ACTIVE_FAMILIES_PER_USER);
    expect(active.some((r) => r.familyId === first.familyId)).toBe(false);
    const evicted = await prisma.refreshToken.findFirst({ where: { familyId: first.familyId } });
    expect(evicted?.revokedReason).toBe('family_cap');
  });
});
