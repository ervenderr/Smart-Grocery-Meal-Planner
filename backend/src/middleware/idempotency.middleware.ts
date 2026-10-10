/**
 * Idempotency-Key middleware.
 *
 * Mount per router AFTER authenticate (and limiter): router.use(idempotency).
 * No-op for GET/HEAD/OPTIONS or when the header is absent.
 *
 * Protocol: reserve (INSERT ... ON CONFLICT DO NOTHING) -> run handler ->
 * persist 2xx response BEFORE sending it -> replay stored response on retry.
 * Non-2xx responses are never cached (the reservation is released).
 *
 * Client disconnects never release the reservation; the handler finishes and
 * its completion is persisted so a retry replays instead of double-applying.
 * A truly crashed request is recovered by the stale-takeover timeout.
 *
 * Accepted residual risk (research A3): if the process dies after the business
 * commit but before the completion write, a retry can double-apply. Railway
 * runs a single replica and the window is one UPDATE.
 */

import { NextFunction, Request, RequestHandler, Response } from 'express';
import { Prisma } from '@prisma/client';
import { AppError } from './errorHandler';
import { logger } from '@/config/logger.config';
import {
  IDEMPOTENCY_ERROR_CODES,
  IDEMPOTENCY_HEADER,
  IDEMPOTENCY_MAX_STORED_BODY_BYTES,
  IDEMPOTENCY_REPLAYED_HEADER,
  IDEMPOTENCY_STALE_IN_PROGRESS_MS,
  IDEMPOTENCY_STATUS,
  IDEMPOTENT_METHODS_SKIPPED,
  idempotencyKeySchema,
} from '@/modules/idempotency/idempotency.constants';
import { computeRequestHash } from '@/modules/idempotency/idempotency.hash';
import {
  complete,
  findByUserKey,
  release,
  reserve,
  takeOver,
} from '@/modules/idempotency/idempotency.store';

type StoredRow = NonNullable<Awaited<ReturnType<typeof findByUserKey>>>;

interface Claim {
  readonly userId: string;
  readonly key: string;
  readonly method: string;
  readonly route: string;
  readonly requestHash: string;
}

type Outcome =
  | { readonly kind: 'owned'; readonly id: string; readonly claimedAt: Date }
  | { readonly kind: 'responded' };

function inFlight(res: Response): AppError {
  res.setHeader('Retry-After', '1');
  return new AppError('A request with this Idempotency-Key is still in progress', 409, true, {
    code: IDEMPOTENCY_ERROR_CODES.IN_FLIGHT,
  });
}

function replay(res: Response, row: StoredRow): void {
  res.setHeader(IDEMPOTENCY_REPLAYED_HEADER, 'true');
  res.status(row.responseStatus ?? 200).json(row.responseBody);
}

async function claimExisting(claim: Claim, res: Response): Promise<Outcome> {
  const now = new Date();
  const row = await findByUserKey(claim.userId, claim.key);
  if (!row) {
    // Deleted between INSERT conflict and SELECT (released); caller retries via reserve.
    const id = await reserve({ ...claim, now });
    if (id) return { kind: 'owned', id, claimedAt: now };
    throw inFlight(res);
  }

  const expired = row.expiresAt.getTime() <= now.getTime();
  const stale =
    row.status === IDEMPOTENCY_STATUS.IN_PROGRESS &&
    now.getTime() - row.createdAt.getTime() > IDEMPOTENCY_STALE_IN_PROGRESS_MS;

  if (!expired && row.requestHash !== claim.requestHash) {
    throw new AppError('Idempotency-Key was already used with a different request', 422, true, {
      code: IDEMPOTENCY_ERROR_CODES.KEY_REUSED,
    });
  }
  if (expired || stale) {
    const won = await takeOver(row.id, row.createdAt, { ...claim, now });
    if (!won) throw inFlight(res);
    return { kind: 'owned', id: row.id, claimedAt: now };
  }
  if (row.status === IDEMPOTENCY_STATUS.IN_PROGRESS) throw inFlight(res);

  replay(res, row);
  return { kind: 'responded' };
}

async function persistOrRelease(
  id: string,
  claimedAt: Date,
  userId: string,
  route: string,
  statusCode: number,
  body: unknown
): Promise<void> {
  try {
    const serialised = body === undefined ? undefined : JSON.stringify(body);
    const storable =
      statusCode >= 200 &&
      statusCode < 300 &&
      serialised !== undefined &&
      Buffer.byteLength(serialised) <= IDEMPOTENCY_MAX_STORED_BODY_BYTES;
    if (storable) {
      const kept = await complete(
        id,
        claimedAt,
        statusCode,
        JSON.parse(serialised) as Prisma.InputJsonValue
      );
      if (!kept) logger.warn('Idempotency claim lost before completion', { userId, route });
    } else {
      await release(id, claimedAt);
    }
  } catch (error) {
    // Never log the key or body.
    logger.error('Idempotency persistence failed', {
      userId,
      route,
      error: (error as Error).message,
    });
  }
}

function instrumentResponse(
  res: Response,
  id: string,
  claimedAt: Date,
  userId: string,
  route: string
): void {
  const originalJson = res.json.bind(res);
  let handled = false;

  res.json = ((body?: unknown): Response => {
    if (handled) return originalJson(body);
    handled = true;
    // Persist-before-send: any response a client sees is already recorded.
    // A client disconnect must NOT release the reservation: the handler keeps
    // running and its effect commits, so the completion has to be persisted for
    // the retry to replay (CR-01). Only send if the socket is still usable.
    void persistOrRelease(id, claimedAt, userId, route, res.statusCode, body).then(() => {
      if (!res.writableEnded && !res.destroyed) originalJson(body);
    });
    return res;
  }) as Response['json'];
}

export const idempotency: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const rawKey = req.header(IDEMPOTENCY_HEADER);
    if (IDEMPOTENT_METHODS_SKIPPED.includes(req.method) || rawKey === undefined) {
      next();
      return;
    }

    const parsed = idempotencyKeySchema.safeParse(rawKey);
    if (!parsed.success) {
      throw new AppError('Invalid Idempotency-Key header', 400, true, {
        code: IDEMPOTENCY_ERROR_CODES.KEY_INVALID,
      });
    }
    const userId = (req as Request & { user?: { id: string } }).user?.id;
    if (!userId) throw new AppError('Authentication required', 401);

    const route = `${req.baseUrl}${req.path}`;
    const claim: Claim = {
      userId,
      key: parsed.data,
      method: req.method,
      route,
      requestHash: computeRequestHash(req.method, route, req.body, req.query),
    };

    const reservedAt = new Date();
    const id = await reserve({ ...claim, now: reservedAt });
    const outcome: Outcome = id
      ? { kind: 'owned', id, claimedAt: reservedAt }
      : await claimExisting(claim, res);
    if (outcome.kind === 'responded') return;

    instrumentResponse(res, outcome.id, outcome.claimedAt, claim.userId, route);
    next();
  } catch (error) {
    next(error);
  }
};
