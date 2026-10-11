/**
 * Injectable Apple verifier. The default is built lazily from config so a
 * missing APPLE_APP_APPLE_ID never breaks startup. Test setters always replace
 * the module-level reference (no mutation).
 */

import { config, isProduction } from '../../config/env.config';
import { logger } from '../../config/logger.config';
import { appleRootCertificates, createAppleVerifier, type AppleVerifier } from './apple-verifier';

let current: AppleVerifier | undefined;
let warnedMissingAppId = false;

function buildDefaultVerifier(): AppleVerifier {
  if (isProduction && config.iap.appAppleId === undefined && !warnedMissingAppId) {
    warnedMissingAppId = true;
    logger.warn(
      'APPLE_APP_APPLE_ID is not set: Production purchase verification is disabled until it is configured',
    );
  }
  return createAppleVerifier({
    rootCertificates: appleRootCertificates(),
    bundleId: config.iap.bundleId,
    appAppleId: config.iap.appAppleId,
    onlineChecks: config.iap.onlineChecks,
    allowXcode: config.iap.allowXcodeEnv,
  });
}

export function getAppleVerifier(): AppleVerifier {
  if (!current) current = buildDefaultVerifier();
  return current;
}

export function setAppleVerifierForTests(verifier: AppleVerifier): void {
  current = verifier;
}

export function resetAppleVerifierForTests(): void {
  current = undefined;
}
