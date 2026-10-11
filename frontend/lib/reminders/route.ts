import { z } from 'zod';

export const ALLOWED_NOTIFICATION_ROUTES = ['/pantry/?filter=expiring'] as const;

const extraSchema = z.object({ route: z.enum(ALLOWED_NOTIFICATION_ROUTES) });

/** Validate a notification tap payload; only allowlisted in-app routes pass. */
export function parseNotificationRoute(extra: unknown): string | null {
  const result = extraSchema.safeParse(extra);
  return result.success ? result.data.route : null;
}
