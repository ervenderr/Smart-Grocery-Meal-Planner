'use client';

import { ShotRunner } from '@/components/shot/shot-runner';

/** Screenshot-only route: exists only when built with NEXT_PUBLIC_SHOT=1 (pageExtensions). */
export default function ShotPage() {
  if (process.env.NEXT_PUBLIC_SHOT !== '1') return null;
  return <ShotRunner />;
}
