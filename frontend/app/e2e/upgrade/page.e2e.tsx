'use client';

import { useEffect, useState } from 'react';
import { UpgradeSheetHost } from '@/components/entitlements/upgrade-sheet-host';
import { openUpgradeSheet } from '@/lib/entitlements/upgrade-sheet-store';
import { createMockStore } from '@/lib/native/store/mock-store';
import { setStoreDepsOverride } from '@/lib/native/store/store-deps';

/**
 * E2E/screenshot-only route: exists only when built with NEXT_PUBLIC_E2E=1 (pageExtensions).
 * `?mock=1` uses the scripted mock store; otherwise real StoreKit (Xcode run with Kumaun.storekit).
 */
export default function UpgradeE2ePage() {
  const [ready, setReady] = useState(false);
  const enabled = process.env.NEXT_PUBLIC_E2E === '1';

  useEffect(() => {
    if (!enabled) return;
    const useMock = new URLSearchParams(window.location.search).get('mock') === '1';
    if (useMock) {
      setStoreDepsOverride({
        plugin: createMockStore({ price: '$9.99' }),
        verify: async (_jws, _key) => ({
          status: 'active',
          productId: 'app.kitcha.mobile.full',
          environment: 'Xcode',
          purchasedAt: new Date().toISOString(),
        }),
        newKey: () => `e2e-${Date.now()}`,
        isOnline: () => true,
      });
    }
    openUpgradeSheet();
    setReady(true);
  }, [enabled]);

  if (!enabled || !ready) return null;
  return <UpgradeSheetHost />;
}
