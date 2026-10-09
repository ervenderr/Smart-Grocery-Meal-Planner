'use client';

import type { RefObject } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Flashlight, Loader2, X } from 'lucide-react';

interface CameraViewProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  scanning: boolean;
  torch: { available: boolean; on: boolean; toggle: () => void };
  slowHint: boolean;
  onTypeInstead: () => void;
}

const ICON_BUTTON =
  'flex h-11 w-11 items-center justify-center rounded-lg text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500';

const BRACKETS = [
  'left-0 top-0 border-l-4 border-t-4 rounded-tl-xl',
  'right-0 top-0 border-r-4 border-t-4 rounded-tr-xl',
  'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-xl',
  'bottom-0 right-0 border-b-4 border-r-4 rounded-br-xl',
];

/** Black top bar shared by every camera-related state. */
export function CameraTopBar({ torch }: { torch?: CameraViewProps['torch'] }) {
  return (
    <div className="pt-safe flex h-14 shrink-0 items-center gap-2 bg-black/60 px-4">
      <Dialog.Close aria-label="Close scanner" className={`-ml-2 ${ICON_BUTTON}`}>
        <X className="h-5 w-5" aria-hidden="true" />
      </Dialog.Close>
      <Dialog.Title className="flex-1 text-xl font-semibold text-white">Scan barcode</Dialog.Title>
      {torch?.available && (
        <button
          type="button"
          aria-label="Torch"
          aria-pressed={torch.on}
          onClick={torch.toggle}
          className={`${ICON_BUTTON} ${torch.on ? 'bg-white/20' : ''}`}
        >
          <Flashlight className="h-5 w-5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export function CameraView({
  videoRef,
  scanning,
  torch,
  slowHint,
  onTypeInstead,
}: CameraViewProps) {
  return (
    <div className="relative flex h-full flex-col bg-black">
      <CameraTopBar torch={scanning ? torch : undefined} />
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
        />
        {scanning ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="relative h-40 w-64 rounded-xl bg-transparent shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
              {BRACKETS.map((position) => (
                <span
                  key={position}
                  className={`border-primary-500 absolute h-8 w-8 ${position}`}
                  aria-hidden="true"
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black text-white">
            <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
            <p className="text-base">Starting camera...</p>
          </div>
        )}
      </div>
      <div className="pb-safe space-y-2 bg-black/70 px-4 py-4 text-center">
        <p className="text-base text-white">Point your camera at the barcode.</p>
        {slowHint && (
          <p className="text-sm text-gray-300">Hold steady and make sure there is enough light.</p>
        )}
        <button
          type="button"
          onClick={onTypeInstead}
          className="min-h-11 text-sm font-semibold text-white underline"
        >
          Type the barcode instead
        </button>
      </div>
    </div>
  );
}
