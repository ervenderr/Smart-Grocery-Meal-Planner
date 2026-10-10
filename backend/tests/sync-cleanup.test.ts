import { randomBytes } from 'node:crypto';
import { prisma } from '../src/config/database.config';
import { pruneExpiredSyncRows } from '../src/modules/idempotency/idempotency.cleanup';

const PREFIX = `sync-clean-${Date.now()}`;
const DAY = 86_400_000;

describe('pruneExpiredSyncRows', () => {
  const now = new Date();
  let userId: string;
  let otherId: string;

  const mkUser = async (suffix: string) =>
    (
      await prisma.user.create({
        data: { email: `${PREFIX}-${suffix}@example.com`, passwordHash: 'x' },
        select: { id: true },
      })
    ).id;

  const mkKey = (uid: string, key: string, expiresAt: Date) =>
    prisma.idempotencyKey.create({
      data: {
        userId: uid,
        key,
        method: 'POST',
        route: '/x',
        requestHash: 'h',
        status: 'completed',
        expiresAt,
      },
    });

  const mkToken = (uid: string, expiresAt: Date, revokedAt: Date | null = null) =>
    prisma.refreshToken.create({
      data: {
        userId: uid,
        tokenHash: randomBytes(32).toString('hex'),
        familyId: randomBytes(8).toString('hex'),
        expiresAt,
        revokedAt,
        revokedReason: revokedAt ? 'rotated' : null,
      },
    });

  beforeAll(async () => {
    userId = await mkUser('a');
    otherId = await mkUser('b');
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  });

  it('prunes only expired idempotency keys and stale refresh tokens', async () => {
    await mkKey(userId, 'expired-key-1', new Date(now.getTime() - DAY));
    await mkKey(userId, 'live-key-0001', new Date(now.getTime() + DAY));
    await mkKey(otherId, 'other-live-001', new Date(now.getTime() + DAY));

    const future = new Date(now.getTime() + 30 * DAY);
    await mkToken(userId, new Date(now.getTime() - DAY)); // expired
    await mkToken(userId, future, new Date(now.getTime() - 8 * DAY)); // revoked long ago
    const keepActive = await mkToken(userId, future);
    const keepRecent = await mkToken(userId, future, new Date(now.getTime() - 2 * DAY));
    const keepOther = await mkToken(otherId, future);

    const result = await pruneExpiredSyncRows(now);

    expect(result.idempotencyKeys).toBeGreaterThanOrEqual(1);
    expect(result.refreshTokens).toBeGreaterThanOrEqual(2);

    const keys = await prisma.idempotencyKey.findMany({
      where: { userId: { in: [userId, otherId] } },
      select: { key: true },
    });
    expect(keys.map((k) => k.key).sort()).toEqual(['live-key-0001', 'other-live-001']);

    const tokens = await prisma.refreshToken.findMany({
      where: { userId: { in: [userId, otherId] } },
      select: { id: true },
    });
    expect(tokens.map((t) => t.id).sort()).toEqual(
      [keepActive.id, keepRecent.id, keepOther.id].sort()
    );
  });

  it('returns zero counts when nothing is expired for these rows', async () => {
    const result = await pruneExpiredSyncRows(now);
    expect(result.idempotencyKeys).toBeGreaterThanOrEqual(0);
    expect(result.refreshTokens).toBeGreaterThanOrEqual(0);
  });
});
