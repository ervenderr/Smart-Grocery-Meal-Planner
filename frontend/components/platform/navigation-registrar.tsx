'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { registerNavigator } from '@/lib/platform/navigation';
import { whenTokenStorageReady } from '@/lib/api/token-storage';

/** Registers the client-side router for navigate() and starts Keychain hydration. */
export function NavigationRegistrar() {
  const router = useRouter();

  useEffect(() => {
    void whenTokenStorageReady();
  }, []);

  useEffect(
    () =>
      registerNavigator((path, opts) => {
        if (opts.replace) router.replace(path);
        else router.push(path);
      }),
    [router]
  );

  return null;
}
