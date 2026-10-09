'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import {
  mapCameraError,
  pickFirstDetection,
  SCAN_FORMATS,
  supportsFormats,
  type CameraFailure,
} from './camera';

const DETECT_INTERVAL_MS = 200;
const SLOW_HINT_MS = 8000;
const VIBRATE_MS = 50;

type ScannerStatus = 'idle' | 'requesting' | 'scanning' | 'failed';

interface Detector {
  detect: (source: ImageBitmapSource) => Promise<readonly { rawValue?: unknown }[]>;
}

interface DetectorCtor {
  new (options: { formats: string[] }): Detector;
  getSupportedFormats: () => Promise<string[]>;
}

interface UseBarcodeScannerOptions {
  active: boolean;
  onDetected: (code: string) => void;
}

export interface BarcodeScanner {
  status: ScannerStatus;
  failure: CameraFailure | null;
  videoRef: RefObject<HTMLVideoElement | null>;
  torch: { available: boolean; on: boolean; toggle: () => void };
  slowHint: boolean;
  retry: () => void;
  stop: () => void;
}

async function createDetector(): Promise<Detector> {
  const formats = [...SCAN_FORMATS];
  try {
    const native = (globalThis as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
    if (native) {
      const supported = await native.getSupportedFormats();
      if (supportsFormats(supported)) return new native({ formats });
    }
  } catch {
    // fall through to the ponyfill
  }
  const { BarcodeDetector } = await import('barcode-detector/ponyfill');
  return new BarcodeDetector({ formats: formats as unknown as never }) as unknown as Detector;
}

async function detectOnce(detector: Detector, video: HTMLVideoElement) {
  try {
    return await detector.detect(video);
  } catch (err) {
    if (!(err instanceof TypeError) || typeof createImageBitmap !== 'function') throw err;
    const bitmap = await createImageBitmap(video);
    try {
      return await detector.detect(bitmap);
    } finally {
      bitmap.close();
    }
  }
}

export function useBarcodeScanner({
  active,
  onDetected,
}: UseBarcodeScannerOptions): BarcodeScanner {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const detectedRef = useRef(false);
  const onDetectedRef = useRef(onDetected);
  const [status, setStatus] = useState<ScannerStatus>('idle');
  const [failure, setFailure] = useState<CameraFailure | null>(null);
  const [slowHint, setSlowHint] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  const release = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
    timerRef.current = null;
    slowTimerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const stop = useCallback(() => {
    release();
    setStatus('idle');
    setTorchAvailable(false);
    setTorchOn(false);
    setSlowHint(false);
  }, [release]);

  useEffect(() => {
    const onVisibility = () => setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    if (!active || !visible) return;
    let cancelled = false;
    detectedRef.current = false;

    const start = async () => {
      setStatus('requesting');
      setFailure(null);
      setSlowHint(false);
      const hasMediaDevices = !!navigator.mediaDevices?.getUserMedia;
      try {
        if (!hasMediaDevices) throw new Error('no mediaDevices');
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) throw new Error('no video element');
        video.srcObject = stream;
        await video.play();
        const detector = await createDetector();
        if (cancelled) return;

        const track = stream.getVideoTracks()[0];
        const caps = track?.getCapabilities?.() as { torch?: boolean } | undefined;
        setTorchAvailable(caps?.torch === true);
        setStatus('scanning');
        slowTimerRef.current = setTimeout(() => setSlowHint(true), SLOW_HINT_MS);

        const tick = async () => {
          if (cancelled || detectedRef.current) return;
          try {
            const code = pickFirstDetection(await detectOnce(detector, video));
            if (code && !cancelled && !detectedRef.current) {
              detectedRef.current = true;
              navigator.vibrate?.(VIBRATE_MS);
              release();
              setStatus('idle');
              onDetectedRef.current(code);
              return;
            }
          } catch {
            // transient frame errors: keep scanning
          }
          if (!cancelled) timerRef.current = setTimeout(() => void tick(), DETECT_INTERVAL_MS);
        };
        void tick();
      } catch (err) {
        if (cancelled) return;
        release();
        setFailure(mapCameraError(err, { hasMediaDevices }));
        setStatus('failed');
      }
    };
    void start();

    return () => {
      cancelled = true;
      release();
    };
  }, [active, visible, attempt, release]);

  const toggleTorch = useCallback(() => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    track
      .applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] })
      .then(() => setTorchOn(next))
      .catch(() => setTorchAvailable(false));
  }, [torchOn]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return {
    status,
    failure,
    videoRef,
    torch: { available: torchAvailable, on: torchOn, toggle: toggleTorch },
    slowHint,
    retry,
    stop,
  };
}
