'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { loadPlugin } from '@/lib/platform/native';
import type { CameraFailure } from './camera';
import { scanNative, type DeviceLike, type NativeScannerLike } from './scan-adapter';

type NativeScannerStatus = 'idle' | 'requesting' | 'scanning' | 'failed';

interface UseNativeScannerOptions {
  active: boolean;
  onDetected: (code: string) => void;
  onCancel?: () => void;
}

export interface NativeScanner {
  status: NativeScannerStatus;
  failure: CameraFailure | null;
  readError: boolean;
  retry: () => void;
  stop: () => void;
}

const SCAN_INSTRUCTIONS = 'Point the camera at a barcode';

async function loadScanner(): Promise<{
  scanner: NativeScannerLike | null;
  device: DeviceLike | null;
  options: Record<string, unknown>;
}> {
  const [scannerMod, deviceMod] = await Promise.all([
    loadPlugin(() => import('@capacitor/barcode-scanner')),
    loadPlugin(() => import('@capacitor/device')),
  ]);
  const hint = scannerMod?.CapacitorBarcodeScannerTypeHint.ALL;
  const back = scannerMod?.CapacitorBarcodeScannerCameraDirection.BACK;
  return {
    scanner: (scannerMod?.CapacitorBarcodeScanner as unknown as NativeScannerLike) ?? null,
    device: (deviceMod?.Device as unknown as DeviceLike) ?? null,
    options: {
      hint,
      scanInstructions: SCAN_INSTRUCTIONS,
      scanButton: false,
      cameraDirection: back,
    },
  };
}

/** Native (Capacitor) scan engine with the same shape as useBarcodeScanner. */
export function useNativeScanner({
  active,
  onDetected,
  onCancel,
}: UseNativeScannerOptions): NativeScanner {
  const detectedRef = useRef(false);
  const onDetectedRef = useRef(onDetected);
  const onCancelRef = useRef(onCancel);
  const [status, setStatus] = useState<NativeScannerStatus>('idle');
  const [failure, setFailure] = useState<CameraFailure | null>(null);
  const [readError, setReadError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    onDetectedRef.current = onDetected;
    onCancelRef.current = onCancel;
  }, [onDetected, onCancel]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    detectedRef.current = false;

    const run = async () => {
      setStatus('requesting');
      setFailure(null);
      setReadError(false);
      const deps = await loadScanner();
      if (cancelled) return;
      const outcome = await scanNative(deps);
      if (cancelled) return;
      switch (outcome.kind) {
        case 'code':
          if (detectedRef.current) return;
          detectedRef.current = true;
          setStatus('idle');
          onDetectedRef.current(outcome.code);
          return;
        case 'cancelled':
          setStatus('idle');
          onCancelRef.current?.();
          return;
        case 'invalid':
          setReadError(true);
          setStatus('failed');
          return;
        case 'failure':
          setFailure(outcome.failure);
          setStatus('failed');
          return;
      }
    };
    void run();

    return () => {
      cancelled = true;
      setStatus((prev) => (prev === 'failed' ? prev : 'idle'));
    };
  }, [active, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const stop = useCallback(() => setStatus('idle'), []);

  return Object.freeze({ status, failure, readError, retry, stop });
}
