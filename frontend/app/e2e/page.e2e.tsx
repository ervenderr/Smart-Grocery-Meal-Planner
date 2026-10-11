'use client';

import { E2eRunner } from '@/components/e2e/e2e-runner';
import { OfflineE2eRunner } from '@/components/e2e/offline-runner';

/** E2E-only route: exists only when built with NEXT_PUBLIC_E2E=1 (pageExtensions). */
export default function E2ePage() {
  if (process.env.NEXT_PUBLIC_E2E !== '1') return null;
  if (process.env.NEXT_PUBLIC_E2E_SUITE === 'offline') return <OfflineE2eRunner />;
  return <E2eRunner />;
}
