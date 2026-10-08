'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  illustration?: ReactNode;
  headingLevel?: 'h2' | 'h3';
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  illustration,
  headingLevel = 'h2',
}: EmptyStateProps) {
  const reduceMotion = useReducedMotion();
  const Heading = headingLevel;

  const fade = (delay: number) =>
    reduceMotion
      ? {}
      : {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          transition: { delay, duration: 0.4 },
        };

  const containerMotion = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.4 },
      };

  const iconMotion = reduceMotion
    ? {}
    : {
        initial: { scale: 0.8, opacity: 0 },
        animate: { scale: 1, opacity: 1 },
        transition: { delay: 0.1, duration: 0.4 },
      };

  return (
    <motion.div
      {...containerMotion}
      className="flex flex-col items-center justify-center px-4 py-12 text-center"
    >
      {/* Illustration or Icon */}
      <motion.div {...iconMotion} className="mb-6">
        {illustration ||
          (Icon && (
            <div className="rounded-full bg-gray-100 p-4">
              <Icon className="h-12 w-12 text-gray-400" aria-hidden="true" />
            </div>
          ))}
      </motion.div>

      {/* Title */}
      <motion.div {...fade(0.2)}>
        <Heading className="mb-2 text-xl font-semibold text-gray-900">{title}</Heading>
      </motion.div>

      {/* Description */}
      <motion.p {...fade(0.3)} className="mb-6 max-w-sm text-base text-gray-600">
        {description}
      </motion.p>

      {/* Actions */}
      {((actionLabel && onAction) || (secondaryActionLabel && onSecondaryAction)) && (
        <motion.div
          {...fade(0.4)}
          className="flex w-full flex-col justify-center gap-2 sm:w-auto sm:flex-row"
        >
          {actionLabel && onAction && (
            <Button onClick={onAction} className="w-full sm:w-auto">
              {actionLabel}
            </Button>
          )}
          {secondaryActionLabel && onSecondaryAction && (
            <Button onClick={onSecondaryAction} variant="outline" className="w-full sm:w-auto">
              {secondaryActionLabel}
            </Button>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
