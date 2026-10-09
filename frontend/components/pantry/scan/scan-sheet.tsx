'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { foodApi } from '@/lib/api/food';
import { pantryApi } from '@/lib/api/pantry';
import { isIosSafari, isStandalone } from '@/lib/pwa/detect-ios';
import { resolveBarcode, type BarcodeResolution } from '@/lib/scan/resolve-barcode';
import { isCameraAvailable } from '@/lib/scan/merge-scan';
import { useBarcodeScanner } from '@/lib/scan/use-barcode-scanner';
import { CameraView } from './camera-view';
import { ManualBarcodeForm } from './manual-barcode-form';
import {
  CameraBusyCard,
  CameraDeniedCard,
  LookingUp,
  LookupFailedCard,
  ScanUnsupportedCard,
  UnknownProductCard,
} from './scan-states';

export type ScanState =
  | { name: 'requesting' }
  | { name: 'scanning' }
  | { name: 'denied' }
  | { name: 'busy' }
  | { name: 'unsupported' }
  | { name: 'manual' }
  | { name: 'looking-up'; barcode: string }
  | { name: 'unknown'; barcode: string }
  | { name: 'failed'; barcode: string };

interface ScanSheetProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'lookup' | 'return';
  onResolved?: (resolution: BarcodeResolution) => void;
  onBarcode?: (code: string) => void;
  onAddWithoutBarcode?: () => void;
}

const realDeps = {
  findOwn: async (barcode: string) => {
    const response = await pantryApi.getAll({
      barcode,
      limit: 1,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
    return response.items[0] ?? null;
  },
  lookup: (barcode: string) => foodApi.lookupBarcode(barcode),
};

const STATUS_TEXT: Record<ScanState['name'], string> = {
  requesting: 'Starting camera',
  scanning: 'Camera ready. Point at a barcode.',
  denied: 'Camera access is off',
  busy: 'Camera is busy',
  unsupported: "Scanning isn't available here",
  manual: '',
  'looking-up': 'Barcode detected.',
  unknown: 'Product not found.',
  failed: "Couldn't look up this product",
};

export function ScanSheet({ isOpen, onClose, ...rest }: ScanSheetProps) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Content
          aria-describedby={undefined}
          className="animate-fade-in fixed inset-0 z-50 flex h-dvh flex-col bg-white focus:outline-none"
        >
          {/* Mounted only while open, so state resets to 'manual' on every open. */}
          <ScanBody onClose={onClose} {...rest} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ScanBody({
  onClose,
  mode,
  onResolved,
  onBarcode,
  onAddWithoutBarcode,
}: Omit<ScanSheetProps, 'isOpen'>) {
  const [state, setState] = useState<ScanState>(() =>
    hasMediaDevices() ? { name: 'requesting' } : { name: 'unsupported' }
  );
  const busyRef = useRef(false);
  const lookupRef = useRef<(barcode: string) => void>(() => undefined);
  const handleDetected = useCallback((code: string) => lookupRef.current(code), []);
  const scanner = useBarcodeScanner({
    active: state.name === 'requesting',
    onDetected: handleDetected,
  });
  const view = deriveView(state, scanner.status, scanner.failure);

  const lookup = useCallback(
    async (barcode: string) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setState({ name: 'looking-up', barcode });
      try {
        const resolution = await resolveBarcode(barcode, realDeps);
        if (resolution.kind === 'own' || resolution.kind === 'found') {
          onResolved?.(resolution);
          onClose();
        } else {
          setState(
            resolution.kind === 'unknown'
              ? { name: 'unknown', barcode }
              : { name: 'failed', barcode }
          );
        }
      } finally {
        busyRef.current = false;
      }
    },
    [onClose, onResolved]
  );

  const handleDetectedCode = (barcode: string) => {
    if (mode === 'return') {
      onBarcode?.(barcode);
      onClose();
      return;
    }
    void lookup(barcode);
  };
  useEffect(() => {
    lookupRef.current = handleDetectedCode;
  });

  const toManual = () => {
    scanner.stop();
    setState({ name: 'manual' });
  };

  const handleSubmit = (barcode: string) => {
    if (mode === 'return') {
      onBarcode?.(barcode);
      onClose();
      return;
    }
    void lookup(barcode);
  };

  const addManually = (barcode: string) => {
    onResolved?.({ kind: 'unknown', barcode });
    onClose();
  };

  const withoutBarcode =
    mode === 'lookup' && onAddWithoutBarcode
      ? () => {
          onAddWithoutBarcode();
          onClose();
        }
      : undefined;

  if (view === 'requesting' || view === 'scanning') {
    return (
      <>
        <LiveRegion text={STATUS_TEXT[view]} />
        <CameraView
          videoRef={scanner.videoRef}
          scanning={view === 'scanning'}
          torch={scanner.torch}
          slowHint={scanner.slowHint}
          onTypeInstead={toManual}
        />
      </>
    );
  }
  if (view === 'denied' || view === 'busy' || view === 'unsupported') {
    return (
      <>
        <LiveRegion text={STATUS_TEXT[view]} />
        {view === 'denied' ? (
          <CameraDeniedCard
            iosStandalone={isIosStandalone()}
            onTypeInstead={toManual}
            onRetry={scanner.retry}
          />
        ) : view === 'busy' ? (
          <CameraBusyCard onTypeInstead={toManual} onRetry={scanner.retry} />
        ) : (
          <ScanUnsupportedCard onTypeInstead={toManual} />
        )}
      </>
    );
  }

  return (
    <div className="pt-safe pb-safe flex h-full flex-col">
      <div className="flex h-14 items-center gap-2 border-b border-gray-200 px-4">
        <Dialog.Close
          aria-label="Close scanner"
          className="focus-visible:ring-primary-500 -ml-2 flex h-11 w-11 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 focus-visible:ring-2 focus-visible:outline-none"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </Dialog.Close>
        <Dialog.Title className="text-xl font-semibold text-gray-900">Scan barcode</Dialog.Title>
      </div>

      <LiveRegion text={STATUS_TEXT[state.name]} />

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto w-full max-w-md">
          {state.name === 'manual' && (
            <ManualBarcodeForm
              onSubmit={handleSubmit}
              onAddWithoutBarcode={withoutBarcode}
              submitLabel={mode === 'return' ? 'Use this barcode' : 'Look up barcode'}
              cameraAvailable={isCameraAvailable({
                hasMediaDevices: hasMediaDevices(),
                failure: scanner.failure,
              })}
              onScanWithCamera={() => setState({ name: 'requesting' })}
            />
          )}
          {state.name === 'looking-up' && <LookingUp barcode={state.barcode} />}
          {state.name === 'unknown' && (
            <UnknownProductCard
              barcode={state.barcode}
              onAddManually={() => addManually(state.barcode)}
              onSecondary={() => setState({ name: 'requesting' })}
            />
          )}
          {state.name === 'failed' && (
            <LookupFailedCard
              barcode={state.barcode}
              onAddManually={() => addManually(state.barcode)}
              onSecondary={() => void lookup(state.barcode)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function LiveRegion({ text }: { text: string }) {
  return (
    <div role="status" aria-live="polite" className="sr-only">
      {text}
    </div>
  );
}

function hasMediaDevices(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}

function isIosStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    isIosSafari(nav) &&
    isStandalone({
      navigatorStandalone: nav.standalone,
      displayModeStandalone: window.matchMedia('(display-mode: standalone)').matches,
    })
  );
}

/** Maps the sheet state plus live camera status to the view that should render. */
function deriveView(
  state: ScanState,
  status: ReturnType<typeof useBarcodeScanner>['status'],
  failure: ReturnType<typeof useBarcodeScanner>['failure']
): ScanState['name'] {
  if (state.name !== 'requesting') return state.name;
  if (status === 'scanning') return 'scanning';
  if (status === 'failed') {
    if (failure === 'denied') return 'denied';
    return failure === 'busy' ? 'busy' : 'unsupported';
  }
  return 'requesting';
}
