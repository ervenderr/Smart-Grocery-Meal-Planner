import {
  Environment,
  SignedDataVerifier,
  VerificationException,
  VerificationStatus,
} from '@apple/app-store-server-library';
import type { JWSTransactionDecodedPayload } from '@apple/app-store-server-library';
import { APPLE_ROOT_CA_G3_DER_BASE64 } from './apple-root-g3';

export type AppleEnvironmentName = 'Sandbox' | 'Production' | 'Xcode';

export interface AppleVerifierOptions {
  rootCertificates: readonly Buffer[];
  bundleId: string;
  appAppleId?: number;
  onlineChecks: boolean;
  allowXcode: boolean;
}

export interface VerifiedTransaction {
  readonly transactionId: string;
  readonly originalTransactionId: string;
  readonly bundleId: string;
  readonly productId: string;
  readonly type: string;
  readonly environment: AppleEnvironmentName;
  readonly purchaseDate: Date;
  readonly signedDate: Date;
  readonly revocationDate: Date | null;
  readonly revocationReason: number | null;
}

export interface VerifiedNotification {
  readonly notificationUUID: string;
  readonly notificationType: string;
  readonly subtype: string | null;
  readonly signedDate: Date;
  readonly environment: AppleEnvironmentName;
  readonly transaction: VerifiedTransaction | null;
}

export type AppleVerificationErrorKind = 'invalid' | 'retryable' | 'not_configured';

export class AppleVerificationError extends Error {
  readonly kind: AppleVerificationErrorKind;
  readonly status?: number;

  constructor(kind: AppleVerificationErrorKind, status?: number) {
    super(`Apple verification failed (${kind})`);
    this.name = 'AppleVerificationError';
    this.kind = kind;
    this.status = status;
  }
}

export interface AppleVerifier {
  verifyTransaction(jws: string): Promise<VerifiedTransaction>;
  verifyNotification(signedPayload: string): Promise<VerifiedNotification>;
}

export function appleRootCertificates(): Buffer[] {
  return [Buffer.from(APPLE_ROOT_CA_G3_DER_BASE64, 'base64')];
}

const BASE64URL_SEGMENT = /^[A-Za-z0-9_-]+$/;

/** Reads the payload WITHOUT verifying it; only used to pick the verifier environment. */
function peekPayload(jws: unknown): Record<string, unknown> {
  if (typeof jws !== 'string') throw new AppleVerificationError('invalid');
  const parts = jws.split('.');
  if (parts.length !== 3 || !parts.every((p) => BASE64URL_SEGMENT.test(p))) {
    throw new AppleVerificationError('invalid');
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new AppleVerificationError('invalid');
    }
    return parsed as Record<string, unknown>;
  } catch (e) {
    if (e instanceof AppleVerificationError) throw e;
    throw new AppleVerificationError('invalid');
  }
}

function toEnvironment(value: unknown): Environment {
  switch (value) {
    case 'Sandbox':
      return Environment.SANDBOX;
    case 'Production':
      return Environment.PRODUCTION;
    case 'Xcode':
      return Environment.XCODE;
    case 'LocalTesting':
      return Environment.LOCAL_TESTING;
    default:
      throw new AppleVerificationError('invalid');
  }
}

function toEnvironmentName(env: Environment): AppleEnvironmentName {
  if (env === Environment.SANDBOX) return 'Sandbox';
  if (env === Environment.PRODUCTION) return 'Production';
  return 'Xcode';
}

function mapError(err: unknown): AppleVerificationError {
  if (err instanceof AppleVerificationError) return err;
  if (err instanceof VerificationException) {
    const retryable = err.status === VerificationStatus.RETRYABLE_VERIFICATION_FAILURE;
    return new AppleVerificationError(retryable ? 'retryable' : 'invalid', err.status);
  }
  return new AppleVerificationError('invalid');
}

function toDate(ms: unknown): Date {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) throw new AppleVerificationError('invalid');
  return new Date(ms);
}

function toTransaction(
  tx: JWSTransactionDecodedPayload,
  environment: AppleEnvironmentName,
): VerifiedTransaction {
  const { transactionId, originalTransactionId, bundleId, productId } = tx;
  if (!transactionId || !originalTransactionId || !bundleId || !productId) {
    throw new AppleVerificationError('invalid');
  }
  return Object.freeze({
    transactionId: String(transactionId),
    originalTransactionId: String(originalTransactionId),
    bundleId,
    productId,
    type: tx.type ?? '',
    environment,
    purchaseDate: toDate(tx.purchaseDate),
    signedDate: toDate(tx.signedDate),
    revocationDate: tx.revocationDate === undefined ? null : toDate(tx.revocationDate),
    revocationReason: typeof tx.revocationReason === 'number' ? tx.revocationReason : null,
  });
}

export function createAppleVerifier(opts: AppleVerifierOptions): AppleVerifier {
  const roots = [...opts.rootCertificates];
  const cache = new Map<Environment, SignedDataVerifier>();

  function verifierFor(env: Environment): SignedDataVerifier {
    const isXcode = env === Environment.XCODE || env === Environment.LOCAL_TESTING;
    if (isXcode && !opts.allowXcode) throw new AppleVerificationError('invalid');
    if (env === Environment.PRODUCTION && opts.appAppleId === undefined) {
      throw new AppleVerificationError('not_configured');
    }
    const existing = cache.get(env);
    if (existing) return existing;
    const created = new SignedDataVerifier(
      roots,
      opts.onlineChecks,
      env,
      opts.bundleId,
      opts.appAppleId,
    );
    cache.set(env, created);
    return created;
  }

  async function decodeTransaction(
    verifier: SignedDataVerifier,
    jws: string,
    env: Environment,
  ): Promise<VerifiedTransaction> {
    const decoded = await verifier.verifyAndDecodeTransaction(jws);
    return toTransaction(decoded, toEnvironmentName(env));
  }

  return {
    async verifyTransaction(jws) {
      try {
        const env = toEnvironment(peekPayload(jws).environment);
        return await decodeTransaction(verifierFor(env), jws, env);
      } catch (err) {
        throw mapError(err);
      }
    },

    async verifyNotification(signedPayload) {
      try {
        const data = peekPayload(signedPayload).data;
        const dataEnv =
          data !== null && typeof data === 'object'
            ? (data as Record<string, unknown>).environment
            : undefined;
        const env = toEnvironment(dataEnv);
        const verifier = verifierFor(env);
        const decoded = await verifier.verifyAndDecodeNotification(signedPayload);
        const { notificationUUID, notificationType } = decoded;
        if (!notificationUUID || !notificationType) throw new AppleVerificationError('invalid');
        const signedTx = decoded.data?.signedTransactionInfo;
        const transaction = signedTx ? await decodeTransaction(verifier, signedTx, env) : null;
        return Object.freeze({
          notificationUUID,
          notificationType: String(notificationType),
          subtype: decoded.subtype ? String(decoded.subtype) : null,
          signedDate: toDate(decoded.signedDate),
          environment: toEnvironmentName(env),
          transaction,
        });
      } catch (err) {
        throw mapError(err);
      }
    },
  };
}
