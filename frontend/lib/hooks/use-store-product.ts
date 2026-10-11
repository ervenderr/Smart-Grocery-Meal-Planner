'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePlatform } from '@/lib/platform/use-platform';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useIsOnline } from '@/lib/offline/status/use-offline-status';
import { getStoreDeps } from '@/lib/native/store/store-deps';
import { loadProduct, type StoreDeps } from '@/lib/native/store/store-service';
import type { StoreProduct } from '@/lib/native/store/store-plugin';

export interface StoreProductState {
  product: StoreProduct | null | undefined;
  productError: boolean;
  retryProduct: () => void;
  isOnlineRef: { readonly current: boolean };
  getDeps: () => Promise<StoreDeps | null>;
}

/** Loads the StoreKit product once per mount on native; null/undefined on web. */
export function useStoreProduct(): StoreProductState {
  const { native } = usePlatform();
  const online = useIsOnline();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const isOnlineRef = useRef(online);
  useEffect(() => {
    isOnlineRef.current = online;
  }, [online]);
  const [product, setProduct] = useState<StoreProduct | null | undefined>(undefined);
  const [productError, setProductError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const getDeps = useCallback(() => getStoreDeps(() => isOnlineRef.current, userId), [userId]);

  useEffect(() => {
    if (!native) return;
    let cancelled = false;
    void (async () => {
      const deps = await getDeps();
      const loaded = deps ? await loadProduct(deps) : null;
      if (cancelled) return;
      setProduct(loaded);
      setProductError(loaded === null);
    })();
    return () => {
      cancelled = true;
    };
  }, [native, attempt, getDeps]);

  const retryProduct = useCallback(() => {
    setProduct(undefined);
    setProductError(false);
    setAttempt((n) => n + 1);
  }, []);

  return { product, productError, retryProduct, isOnlineRef, getDeps };
}
