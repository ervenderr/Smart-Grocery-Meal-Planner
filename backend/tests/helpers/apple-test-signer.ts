import { randomBytes } from 'crypto';
import { readFileSync } from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import {
  createAppleVerifier,
  type AppleVerifier,
  type AppleVerifierOptions,
} from '../../src/modules/entitlements/apple-verifier';

const PKI_DIR = path.join(__dirname, '..', 'fixtures', 'apple-test-pki');

export const TEST_ROOT_DER: Buffer = readFileSync(path.join(PKI_DIR, 'root.der'));
export const TEST_BUNDLE_ID = 'app.kitcha.mobile';
export const TEST_PRODUCT_ID = 'app.kitcha.mobile.full';
export const TEST_APP_APPLE_ID = 1234567890;

const LEAF_KEY = readFileSync(path.join(PKI_DIR, 'leaf.pk8.pem'), 'utf8');
const X5C: string[] = JSON.parse(readFileSync(path.join(PKI_DIR, 'chain.json'), 'utf8'));

// Inside the 100-year validity window of the generated PKI.
export const TEST_SIGNED_MS = Date.UTC(2030, 0, 1);

export interface TxPayload {
  transactionId: string;
  originalTransactionId: string;
  bundleId: string;
  productId: string;
  purchaseDate: number;
  originalPurchaseDate: number;
  quantity: number;
  type: string;
  inAppOwnershipType: string;
  signedDate: number;
  environment: string;
  revocationDate?: number;
  revocationReason?: number;
}

function randomId(): string {
  return BigInt('0x' + randomBytes(7).toString('hex')).toString().padStart(16, '1').slice(0, 16);
}

function sign(payload: object, x5c: readonly string[] = X5C, key: string = LEAF_KEY): string {
  return jwt.sign(payload, key, {
    algorithm: 'ES256',
    header: { alg: 'ES256', x5c: [...x5c] } as jwt.JwtHeader,
  });
}

function txPayload(overrides: Partial<TxPayload> = {}): TxPayload {
  const id = randomId();
  return {
    transactionId: id,
    originalTransactionId: id,
    bundleId: TEST_BUNDLE_ID,
    productId: TEST_PRODUCT_ID,
    purchaseDate: TEST_SIGNED_MS,
    originalPurchaseDate: TEST_SIGNED_MS,
    quantity: 1,
    type: 'Non-Consumable',
    inAppOwnershipType: 'PURCHASED',
    signedDate: TEST_SIGNED_MS,
    environment: 'Sandbox',
    ...overrides,
  };
}

export function testVerifier(overrides: Partial<AppleVerifierOptions> = {}): AppleVerifier {
  return createAppleVerifier({
    rootCertificates: [TEST_ROOT_DER],
    bundleId: TEST_BUNDLE_ID,
    appAppleId: TEST_APP_APPLE_ID,
    onlineChecks: false,
    allowXcode: false,
    ...overrides,
  });
}

export function signTestTransaction(overrides: Partial<TxPayload> = {}): string {
  return sign(txPayload(overrides));
}

/** Signs with a caller-supplied chain/key, e.g. an untrusted PKI. */
export function signWithChain(
  overrides: Partial<TxPayload>,
  x5c: readonly string[],
  privateKeyPem: string,
): string {
  return sign(txPayload(overrides), x5c, privateKeyPem);
}

export function signTestNotification(input: {
  notificationType: string;
  subtype?: string;
  notificationUUID?: string;
  signedDate?: number;
  environment?: 'Sandbox' | 'Production';
  transaction?: Partial<TxPayload>;
  withoutTransaction?: boolean;
}): string {
  const environment = input.environment ?? 'Sandbox';
  const data: Record<string, unknown> = { environment, bundleId: TEST_BUNDLE_ID };
  if (!input.withoutTransaction && input.transaction !== undefined) {
    data.signedTransactionInfo = signTestTransaction({ environment, ...input.transaction });
  }
  return sign({
    notificationType: input.notificationType,
    subtype: input.subtype,
    notificationUUID: input.notificationUUID ?? randomId(),
    signedDate: input.signedDate ?? TEST_SIGNED_MS,
    version: '2.0',
    data,
  });
}
