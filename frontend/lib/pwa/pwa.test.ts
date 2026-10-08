import { describe, expect, it } from 'vitest';
import { isIosSafari, isStandalone } from './detect-ios';
import { HINT_DISMISSED_KEY, safeGetItem, safeSetItem } from './storage';

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const IPAD_SAFARI =
  'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const MAC_SAFARI =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

const withSuffix = (suffix: string) => `${IPHONE_SAFARI} ${suffix}`;

describe('isIosSafari', () => {
  it('detects iPhone Safari', () => {
    expect(isIosSafari({ userAgent: IPHONE_SAFARI, platform: 'iPhone', maxTouchPoints: 5 })).toBe(true);
  });

  it('detects iPad Safari', () => {
    expect(isIosSafari({ userAgent: IPAD_SAFARI, platform: 'iPad', maxTouchPoints: 5 })).toBe(true);
  });

  it('detects iPadOS desktop-mode (MacIntel with touch)', () => {
    expect(isIosSafari({ userAgent: MAC_SAFARI, platform: 'MacIntel', maxTouchPoints: 5 })).toBe(true);
  });

  it('rejects a real Mac', () => {
    expect(isIosSafari({ userAgent: MAC_SAFARI, platform: 'MacIntel', maxTouchPoints: 0 })).toBe(false);
  });

  it.each(['CriOS/124.0', 'FxiOS/124.0', 'EdgiOS/124.0', 'OPiOS/16.0', 'FBAN/FBIOS', 'FBAV/450.0', 'Instagram 300.0', 'Line/13.0', 'MicroMessenger/8.0'])(
    'rejects iOS browsers/in-app webviews: %s',
    (suffix) => {
      expect(isIosSafari({ userAgent: withSuffix(suffix), platform: 'iPhone', maxTouchPoints: 5 })).toBe(false);
    },
  );

  it('rejects Android Chrome', () => {
    expect(isIosSafari({ userAgent: ANDROID_CHROME, platform: 'Linux armv8l', maxTouchPoints: 5 })).toBe(false);
  });
});

describe('isStandalone', () => {
  it('is true for navigator.standalone', () => {
    expect(isStandalone({ navigatorStandalone: true, displayModeStandalone: false })).toBe(true);
  });

  it('is true for display-mode standalone', () => {
    expect(isStandalone({ navigatorStandalone: false, displayModeStandalone: true })).toBe(true);
  });

  it('is false when neither applies', () => {
    expect(isStandalone({ navigatorStandalone: false, displayModeStandalone: false })).toBe(false);
    expect(isStandalone({ displayModeStandalone: false })).toBe(false);
  });
});

describe('safe storage', () => {
  const throwing = {
    getItem: () => {
      throw new Error('denied');
    },
    setItem: () => {
      throw new Error('denied');
    },
  };

  it('uses the expected key', () => {
    expect(HINT_DISMISSED_KEY).toBe('kitcha:ios-install-hint-dismissed');
  });

  it('returns null when getItem throws', () => {
    expect(safeGetItem(throwing, 'k')).toBeNull();
  });

  it('returns false when setItem throws', () => {
    expect(safeSetItem(throwing, 'k', 'v')).toBe(false);
  });

  it('handles an undefined storage', () => {
    expect(safeGetItem(undefined, 'k')).toBeNull();
    expect(safeSetItem(undefined, 'k', 'v')).toBe(false);
  });

  it('round-trips with a working storage', () => {
    const map = new Map<string, string>();
    const storage = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
    };
    expect(safeSetItem(storage, 'k', 'v')).toBe(true);
    expect(safeGetItem(storage, 'k')).toBe('v');
    expect(safeGetItem(storage, 'missing')).toBeNull();
  });
});
