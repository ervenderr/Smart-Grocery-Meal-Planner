/**
 * Current version of the AI data-sharing consent.
 *
 * Bump this when the consent copy or the data sent to AI providers changes.
 * Users whose stored `aiConsentVersion` is lower than this value are treated
 * as not consented and must re-consent.
 */
export const AI_CONSENT_VERSION = 1 as const;
