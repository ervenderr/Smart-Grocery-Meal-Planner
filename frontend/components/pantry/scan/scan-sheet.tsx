'use client';

import { useCallback, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { foodApi } from '@/lib/api/food';
import { pantryApi } from '@/lib/api/pantry';
import { resolveBarcode, type BarcodeResolution } from '@/lib/scan/resolve-barcode';
import { ManualBarcodeForm } from './manual-barcode-form';
import { LookingUp, LookupFailedCard, UnknownProductCard } from './scan-states';

/** 06-11 adds 'requesting' | 'scanning' | 'denied' | 'unsupported'. */
export type ScanState =
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
  manual: '',
  'looking-up': 'Looking up barcode',
  unknown: "We don't know this product yet",
  failed: "Couldn't look up this product",
};

export function ScanSheet({ isOpen, onClose, ...rest }: ScanSheetProps) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-50 flex h-dvh flex-col bg-white pt-safe pb-safe animate-fade-in focus:outline-none"
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
  const [state, setState] = useState<ScanState>({ name: 'manual' });
  const busyRef = useRef(false);

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

  return (
    <>
      <div className="flex h-14 items-center gap-2 border-b border-gray-200 px-4">
        <Dialog.Close
          aria-label="Close scanner"
          className="-ml-2 flex h-11 w-11 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </Dialog.Close>
        <Dialog.Title className="text-xl font-semibold text-gray-900">Scan barcode</Dialog.Title>
      </div>

      <div role="status" aria-live="polite" className="sr-only">
        {STATUS_TEXT[state.name]}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto w-full max-w-md">
          {state.name === 'manual' && (
            <ManualBarcodeForm
              onSubmit={handleSubmit}
              onAddWithoutBarcode={withoutBarcode}
              submitLabel={mode === 'return' ? 'Use this barcode' : 'Look up barcode'}
            />
          )}
          {state.name === 'looking-up' && <LookingUp barcode={state.barcode} />}
          {state.name === 'unknown' && (
            <UnknownProductCard
              barcode={state.barcode}
              onAddManually={() => addManually(state.barcode)}
              onSecondary={() => setState({ name: 'manual' })}
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
    </>
  );
}
