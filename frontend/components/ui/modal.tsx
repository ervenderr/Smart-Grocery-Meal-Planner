'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const SIZE_CLASSES = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
} as const;

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-gray-900/50 backdrop-blur-sm" />
        <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          {/* Mobile first: bottom sheet below sm, centered modal from sm */}
          <Dialog.Content
            aria-describedby={undefined}
            className={`pointer-events-auto relative flex w-full ${SIZE_CLASSES[size]} max-h-[90dvh] sm:max-h-[85dvh] flex-col overflow-hidden rounded-t-2xl sm:rounded-lg bg-white shadow-xl animate-slide-up sm:animate-fade-in focus:outline-none`}
          >
            <div className="flex justify-center pt-2 sm:hidden" aria-hidden="true">
              <div className="h-1 w-12 rounded-full bg-gray-300" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2 sm:px-6 sm:py-3">
              <Dialog.Title className="text-xl font-semibold text-gray-900">{title}</Dialog.Title>
              <Dialog.Close
                aria-label="Close"
                className="-mr-2 flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </Dialog.Close>
            </div>

            {/* Content - Scrollable */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
              {children}
            </div>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
