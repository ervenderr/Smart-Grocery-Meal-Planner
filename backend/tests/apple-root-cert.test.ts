import { createHash } from 'crypto';
import {
  APPLE_ROOT_CA_G3_DER_BASE64,
  APPLE_ROOT_CA_G3_SHA256,
} from '../src/modules/entitlements/apple-root-g3';

const PINNED = '63343ABFB89A6A03EBB57E9B3F5FA7BE7C4F5C756F3017B3A8C488C3653E9179';

describe('Apple Root CA G3 trust anchor', () => {
  it('embedded DER matches the pinned SHA-256 fingerprint', () => {
    const der = Buffer.from(APPLE_ROOT_CA_G3_DER_BASE64, 'base64');
    const digest = createHash('sha256').update(der).digest('hex').toUpperCase();
    expect(digest).toBe(PINNED);
  });

  it('exported pin constant equals the expected fingerprint', () => {
    expect(APPLE_ROOT_CA_G3_SHA256).toBe(PINNED);
  });
});
