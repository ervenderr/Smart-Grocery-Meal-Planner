/**
 * Non-fatal store-readiness checks, surfaced as warnings at build/start time.
 * They never throw: a missing value must not break previews or local builds,
 * but a production build headed for store submission should be loud about it.
 * Imports are relative and dependency-free so next.config.ts can load this file.
 */

import { DRAFT_BANNER_ENABLED, resolveSupportContact } from './legal-config';

export function collectReleaseWarnings(env: Record<string, string | undefined>): string[] {
  const warnings: string[] = [];
  if (resolveSupportContact(env.NEXT_PUBLIC_SUPPORT_EMAIL).kind === 'missing') {
    warnings.push(
      'NEXT_PUBLIC_SUPPORT_EMAIL is missing or not a plain email address. The support page will show "Contact email not configured", which Apple and Google reject.'
    );
  }
  if (DRAFT_BANNER_ENABLED) {
    warnings.push(
      'DRAFT_BANNER_ENABLED is true in lib/legal/legal-config.ts. Privacy and Terms pages show "Draft: pending owner review." Flip it once the owner has reviewed the legal text.'
    );
  }
  return warnings;
}

export function logReleaseWarnings(
  env: Record<string, string | undefined>,
  warn: (message: string) => void = console.warn
): void {
  for (const message of collectReleaseWarnings(env)) {
    warn(`[store-readiness] ${message}`);
  }
}
