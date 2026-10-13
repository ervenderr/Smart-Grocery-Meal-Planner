/**
 * Kumaun is a paid download: the pantry has no per-account item cap.
 */

import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database.config';

const app = createApp();
const EMAIL = `pantry-nolimit-${Date.now()}@example.com`;
const ITEMS_PAST_OLD_FREE_LIMIT = 26;

describe('POST /pantry has no item cap', () => {
  let token = '';
  let userId = '';

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send({ email: EMAIL, password: 'TestPass123', firstName: 'No', lastName: 'Limit' });
    token = res.body.token as string;
    userId = res.body.user.id as string;
  });

  afterAll(async () => {
    await prisma.pantryItem.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it('lets a new account add more than the old 25-item free limit', async () => {
    await prisma.pantryItem.createMany({
      data: Array.from({ length: ITEMS_PAST_OLD_FREE_LIMIT - 1 }, (_, i) => ({
        userId,
        ingredientName: `seed-${i}`,
        quantity: 1,
        unit: 'pieces',
        category: 'other',
      })),
    });

    const res = await request(app)
      .post('/api/v1/pantry')
      .set('Authorization', `Bearer ${token}`)
      .send({ ingredientName: 'Flour', quantity: 2, unit: 'kg', category: 'grains' });

    expect(res.status).toBe(201);
    expect(await prisma.pantryItem.count({ where: { userId, deletedAt: null } })).toBe(
      ITEMS_PAST_OLD_FREE_LIMIT
    );
  });
});
