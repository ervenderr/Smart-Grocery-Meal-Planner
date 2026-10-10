/**
 * Refresh token request validation (zod).
 * Strict objects: unknown keys are rejected.
 */

import { z } from 'zod';

const refreshTokenString = z
  .string()
  .min(20)
  .max(200)
  .regex(/^[A-Za-z0-9_-]+$/);

export const refreshBodySchema = z.object({ refreshToken: refreshTokenString }).strict();

export const logoutBodySchema = z.object({ refreshToken: refreshTokenString.optional() }).strict();

export type RefreshBody = z.infer<typeof refreshBodySchema>;
export type LogoutBody = z.infer<typeof logoutBodySchema>;
