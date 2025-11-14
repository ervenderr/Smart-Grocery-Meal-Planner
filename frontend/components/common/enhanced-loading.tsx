'use client';

import { motion } from 'framer-motion';
import { Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { ReactNode } from 'react';

interface LoadingStateProps {
  isLoading: boolean;
  error?: string | null;
  isEmpty?: boolean;
  emptyMessage?: string;
  emptyIcon?: ReactNode;
  children: ReactNode;
  loadingComponent?: ReactNode;
}

export function LoadingState({
  isLoading,
  error,
  isEmpty = false,
  emptyMessage = 'No data available',
  emptyIcon,
  children,
  loadingComponent,
}: LoadingStateProps) {
  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="flex items-center justify-center py-12"
      >
        {loadingComponent || (
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600 mx-auto" />
            <p className="mt-2 text-sm text-gray-600">Loading...</p>
          </div>
        )}
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center py-12"
      >
        <div className="rounded-full bg-red-100 p-3 mb-3">
          <XCircle className="h-8 w-8 text-red-600" />
        </div>
        <p className="text-lg font-semibold text-gray-900 mb-1">Something went wrong</p>
        <p className="text-sm text-gray-600">{error}</p>
      </motion.div>
    );
  }

  if (isEmpty) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center py-12"
      >
        <div className="rounded-full bg-gray-100 p-3 mb-3">
          {emptyIcon || <AlertCircle className="h-8 w-8 text-gray-400" />}
        </div>
        <p className="text-sm text-gray-600">{emptyMessage}</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {children}
    </motion.div>
  );
}

export function InlineLoader({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-600">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>{message}</span>
    </div>
  );
}

export function SuccessMessage({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800"
    >
      <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
      <span>{message}</span>
    </motion.div>
  );
}

export function ErrorMessage({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800"
    >
      <XCircle className="h-5 w-5 flex-shrink-0" />
      <span>{message}</span>
    </motion.div>
  );
}

export function WarningMessage({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex items-center gap-2 rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800"
    >
      <AlertCircle className="h-5 w-5 flex-shrink-0" />
      <span>{message}</span>
    </motion.div>
  );
}

export function SpinnerOverlay({ message = 'Processing...' }: { message?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-lg bg-white p-6 shadow-xl"
      >
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          <p className="text-sm font-medium text-gray-900">{message}</p>
        </div>
      </motion.div>
    </div>
  );
}

export function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-gray-600 mb-1">
        <span>Progress</span>
        <span>{progress}%</span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="h-full bg-primary-600"
        />
      </div>
    </div>
  );
}
