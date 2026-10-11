/**
 * Shared constants for the one-time unlock (entitlements).
 */

export const ENTITLEMENT_ERROR_CODES = {
  UPGRADE_REQUIRED: "UPGRADE_REQUIRED",
  INVALID_TRANSACTION: "INVALID_TRANSACTION",
  ENTITLEMENT_ALREADY_CLAIMED: "ENTITLEMENT_ALREADY_CLAIMED",
  VERIFICATION_UNAVAILABLE: "VERIFICATION_UNAVAILABLE",
  IAP_NOT_CONFIGURED: "IAP_NOT_CONFIGURED",
} as const;

export const ENTITLEMENT_STATUS = {
  ACTIVE: "active",
  REVOKED: "revoked",
} as const;

export type EntitlementStatusValue = (typeof ENTITLEMENT_STATUS)[keyof typeof ENTITLEMENT_STATUS];

export const PANTRY_LIMIT_FEATURE = "pantry_items";

/** ai_usage scope prefix for per-user monthly counters (scope = usermonth:<userId>). */
export const AI_MONTH_SCOPE_PREFIX = "usermonth:";
