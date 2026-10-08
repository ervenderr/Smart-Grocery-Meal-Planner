/**
 * errorHandler: production message hygiene, details precedence, Prisma mapping.
 */

import type { Request, Response } from 'express';

interface Captured {
  status: number;
  body: Record<string, unknown>;
}

function loadHandler(production: boolean) {
  let mod: typeof import('../src/middleware/errorHandler');
  jest.isolateModules(() => {
    jest.doMock('@/config/env.config', () => ({ isProduction: production }));
    jest.doMock('@/config/logger.config', () => ({
      logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
    }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('../src/middleware/errorHandler');
  });
  return mod!;
}

type ErrorFactory = (AppError: typeof import('../src/middleware/errorHandler').AppError) => Error;

function run(production: boolean, make: Error | ErrorFactory): Captured {
  const { errorHandler, AppError } = loadHandler(production);
  const error = typeof make === 'function' ? make(AppError) : make;
  const captured: Captured = { status: 0, body: {} };
  const res = {
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(body: Record<string, unknown>) {
      captured.body = body;
      return this;
    },
  } as unknown as Response;
  errorHandler(error, { originalUrl: '/x', method: 'GET', ip: '1' } as unknown as Request, res, jest.fn());
  return captured;
}

describe('errorHandler', () => {
  it('hides raw messages of unexpected errors in production', () => {
    const out = run(true, new Error("Can't reach database server at db:5432"));
    expect(out.status).toBe(500);
    expect(out.body.message).toBe('Internal server error');
    expect(JSON.stringify(out.body)).not.toContain('db:5432');
    expect(out.body.stack).toBeUndefined();
  });

  it('keeps raw messages outside production', () => {
    const out = run(false, new Error('boom detail'));
    expect(out.body.message).toBe('boom detail');
  });

  it('does not let AppError details overwrite message/status fields', () => {
    const out = run(true, (AppError) =>
      new AppError('Quota hit', 429, true, {
        code: 'X',
        details: { message: 'evil', statusCode: 200, status: 'ok', retryAfterSeconds: 5 },
      }));
    expect(out.body.message).toBe('Quota hit');
    expect(out.body.statusCode).toBe(429);
    expect(out.body.status).toBe('error');
    expect(out.body.retryAfterSeconds).toBe(5);
    expect(out.body.code).toBe('X');
  });

  it('maps unknown Prisma request errors to 500, P2002 to 400 and P2025 to 404', () => {
    const mk = (code: string) => Object.assign(new Error('prisma'), { name: 'PrismaClientKnownRequestError', code });
    expect(run(true, mk('P1001')).status).toBe(500);
    expect(run(true, mk('P2002')).status).toBe(400);
    expect(run(true, mk('P2025')).status).toBe(404);
  });
});
