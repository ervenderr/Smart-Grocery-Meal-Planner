'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api/auth';
import { flushTokenWrites } from '@/lib/api/token-storage';
import { useAuthStore } from '@/lib/stores/auth-store';
import { findClickTarget, readShotConfig } from '@/lib/shot/shot-config';

/**
 * Store-screenshot runner. Exists only in builds made with NEXT_PUBLIC_SHOT=1 (pageExtensions),
 * never in TestFlight or App Store bundles. Signs in with launch-time credentials and opens the
 * requested route, optionally tapping one element so a sheet (recipe detail) is open.
 */
export function ShotRunner() {
  const router = useRouter();
  const started = useRef(false);
  const [status, setStatus] = useState('starting');

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const config = readShotConfig();
    if (!config) {
      const raw = (window as unknown as { __KUMAUN_SHOT__?: Record<string, unknown> }).__KUMAUN_SHOT__;
      setStatus(`no launch config (keys: ${raw ? Object.keys(raw).join(',') : 'none'})`);
      return;
    }
    void (async () => {
      try {
        const res = await authApi.login({ email: config.email, password: config.password });
        useAuthStore.getState().setAuth(res.token, res.user, res.refreshToken);
        await flushTokenWrites();
        router.replace(config.route);
        const { click, delayMs } = config;
        if (click) {
          // Outlives this component on purpose: the tap happens on the destination page.
          window.setTimeout(() => findClickTarget(document, click)?.click(), delayMs);
        }
      } catch (error) {
        console.error('Shot sign-in failed:', error instanceof Error ? error.message : 'unknown');
        setStatus('sign-in failed');
      }
    })();
  }, [router]);

  return <p className="p-6 text-sm text-gray-500">Screenshot build: {status}</p>;
}
