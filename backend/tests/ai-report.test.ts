/**
 * AI report endpoint: store, validate, size-cap, auth and per-user limiting.
 */

import express from 'express';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/config/database.config';
import { createAiReportLimiter } from '../src/modules/ai/ai-report.limiter';
import { createReport } from '../src/modules/ai/ai-report.controller';
import { asyncHandler } from '../src/middleware/errorHandler';
import { createUserWithPantry } from './helpers/ai-test-helpers';

const app = createApp();
const createdUserIds: string[] = [];

afterAll(async () => {
  await prisma.aiReport.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
});

async function newUser(consent = false) {
  const user = await createUserWithPantry(app, [], { consent });
  createdUserIds.push(user.userId);
  return user;
}

const validBody = () => ({
  kind: 'recipe',
  reason: 'inaccurate_or_unsafe',
  note: 'x',
  snapshot: { name: 'Adobo' },
});

const send = (token: string, body: unknown) =>
  request(app).post('/api/v1/ai/reports').set('Authorization', `Bearer ${token}`).send(body as object);

describe('POST /api/v1/ai/reports', () => {
  it('stores a report for a user without AI consent and returns 201 { id, createdAt }', async () => {
    const { token, userId } = await newUser(false);

    const res = await send(token, { ...validBody(), userId: 'someone-else' });

    expect(res.status).toBe(201);
    expect(res.body.id).toEqual(expect.any(String));
    expect(res.body.createdAt).toEqual(expect.any(String));
    const row = await prisma.aiReport.findUnique({ where: { id: res.body.id } });
    expect(row?.userId).toBe(userId);
    expect(row?.note).toBe('x');
    expect(row?.snapshot).toEqual({ name: 'Adobo' });
  });

  it('accepts optional refId and omitted note', async () => {
    const { token } = await newUser();
    const res = await send(token, { ...validBody(), note: undefined, refId: 'abc' });

    expect(res.status).toBe(201);
    const row = await prisma.aiReport.findUnique({ where: { id: res.body.id } });
    expect(row?.note).toBeNull();
    expect(row?.refId).toBe('abc');
  });

  const invalid: ReadonlyArray<readonly [string, () => Record<string, unknown>]> = [
    ['unknown kind', () => ({ ...validBody(), kind: 'video' })],
    ['unknown reason', () => ({ ...validBody(), reason: 'meh' })],
    ['note over 500 chars', () => ({ ...validBody(), note: 'a'.repeat(501) })],
    ['refId over 100 chars', () => ({ ...validBody(), refId: 'a'.repeat(101) })],
    ['snapshot over 8192 bytes', () => ({ ...validBody(), snapshot: { blob: 'a'.repeat(9000) } })],
    ['snapshot is a string', () => ({ ...validBody(), snapshot: 'text' })],
    ['snapshot is an array', () => ({ ...validBody(), snapshot: [1, 2] })],
    ['missing snapshot', () => ({ kind: 'recipe', reason: 'other' })],
  ];

  it.each(invalid)('rejects %s with 400 VALIDATION_ERROR', async (_name, build) => {
    const { token } = await newUser();

    const res = await send(token, build());

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('requires authentication', async () => {
    const res = await request(app).post('/api/v1/ai/reports').send(validBody());
    expect(res.status).toBe(401);
  });

  it('cascades report deletion when the user is deleted', async () => {
    const { token, userId } = await newUser();
    const res = await send(token, validBody());
    expect(res.status).toBe(201);

    await prisma.user.delete({ where: { id: userId } });

    expect(await prisma.aiReport.count({ where: { userId } })).toBe(0);
  });
});

describe('createAiReportLimiter', () => {
  it('returns 429 AI_REPORT_RATE_LIMITED after the limit within the window', async () => {
    const { userId } = await newUser();
    const mini = express();
    mini.use(express.json());
    mini.use((req, _res, next) => {
      (req as unknown as { user: { id: string } }).user = { id: userId };
      next();
    });
    mini.post('/r', createAiReportLimiter(2), asyncHandler(createReport));

    const first = await request(mini).post('/r').send(validBody());
    const second = await request(mini).post('/r').send(validBody());
    const third = await request(mini).post('/r').send(validBody());

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(third.status).toBe(429);
    expect(third.body.code).toBe('AI_REPORT_RATE_LIMITED');
    expect(third.body.message).toBe("You've sent several reports recently. Try again later.");
  });
});
