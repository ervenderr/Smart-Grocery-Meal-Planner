/**
 * Prisma `where` fragment for pantry rows that represent real stock.
 *
 * Quantity 0 is a legal "used up" state (phase 06), so consumers that care
 * about food that still exists (expiry alerts, notifications, cook-first,
 * Zapier events) must exclude it. The pantry list itself keeps used-up rows
 * visible and should NOT use this fragment.
 */
export const IN_STOCK = { deletedAt: null, quantity: { gt: 0 } } as const;
