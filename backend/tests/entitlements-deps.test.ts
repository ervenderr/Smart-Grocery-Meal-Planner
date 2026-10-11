import {
  getAppleVerifier,
  resetAppleVerifierForTests,
  setAppleVerifierForTests,
} from '../src/modules/entitlements/entitlements.deps';
import type { AppleVerifier } from '../src/modules/entitlements/apple-verifier';

describe('entitlements.deps', () => {
  afterEach(() => resetAppleVerifierForTests());

  it('lazily builds a default verifier and reuses it', () => {
    const first = getAppleVerifier();
    expect(first).toBeDefined();
    expect(getAppleVerifier()).toBe(first);
  });

  it('returns the injected verifier until reset', () => {
    const fake = {} as unknown as AppleVerifier;
    setAppleVerifierForTests(fake);
    expect(getAppleVerifier()).toBe(fake);
    resetAppleVerifierForTests();
    expect(getAppleVerifier()).not.toBe(fake);
  });
});
