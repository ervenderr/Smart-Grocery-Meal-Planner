import type { Request, Response } from 'express';
import { getMe, verifyAndClaim } from './entitlements.service';
import type { VerifyBody } from './entitlements.validation';

const userIdOf = (req: Request): string => (req as Request & { user: { id: string } }).user.id;

/** POST /api/v1/entitlements/verify. The JWS is never logged. */
export async function verify(req: Request, res: Response): Promise<void> {
  const { signedTransaction } = req.body as VerifyBody;
  const view = await verifyAndClaim(userIdOf(req), signedTransaction);
  res.status(200).json(view);
}

/** GET /api/v1/entitlements/me */
export async function me(req: Request, res: Response): Promise<void> {
  res.status(200).json(await getMe(userIdOf(req)));
}
