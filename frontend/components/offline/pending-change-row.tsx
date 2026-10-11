'use client';

import { useState } from 'react';
import { AlertTriangle, CloudUpload, RefreshCw, ShoppingCart, Package, ChefHat, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePlatform } from '@/lib/platform/use-platform';
import { openUpgradeSheet } from '@/lib/entitlements/upgrade-sheet-store';
import type { OutboxOp } from '@/lib/offline/outbox/op-types';
import type { SheetRow } from '@/lib/offline/status/sheet-model';

interface PendingChangeRowProps {
  row: SheetRow;
  kind: OutboxOp['kind'] | undefined;
  onRetry: (seq: number) => void;
  onDiscard: (seq: number) => Promise<void>;
}

const FADE_MS = 200;

function RowIcon({ kind }: { kind: OutboxOp['kind'] | undefined }) {
  const cls = 'mt-0.5 h-5 w-5 shrink-0 text-gray-500';
  if (!kind) return <CloudUpload className={cls} aria-hidden="true" />;
  if (kind.startsWith('shopping')) return <ShoppingCart className={cls} aria-hidden="true" />;
  if (kind.startsWith('pantry')) return <Package className={cls} aria-hidden="true" />;
  return <ChefHat className={cls} aria-hidden="true" />;
}

const BADGE_CLASS: Record<SheetRow['badge']['kind'], string> = {
  waiting: 'bg-gray-100 text-gray-700',
  syncing: 'bg-primary-50 text-primary-700',
  retrying: 'bg-amber-100 text-amber-900',
  failed: 'bg-red-50 text-red-800',
  conflict: 'bg-red-50 text-red-800',
};

function BadgeIcon({ kind }: { kind: SheetRow['badge']['kind'] }) {
  const cls = 'h-3 w-3 shrink-0';
  if (kind === 'syncing') return <RefreshCw className={`${cls} animate-spin motion-reduce:animate-none`} aria-hidden="true" />;
  if (kind === 'retrying') return <Clock className={cls} aria-hidden="true" />;
  if (kind === 'failed' || kind === 'conflict') return <AlertTriangle className={cls} aria-hidden="true" />;
  return <CloudUpload className={cls} aria-hidden="true" />;
}

export function PendingChangeRow({ row, kind, onRetry, onDiscard }: PendingChangeRowProps) {
  const [confirming, setConfirming] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const { native } = usePlatform();
  const failed = row.badge.kind === 'failed' || row.badge.kind === 'conflict';

  const confirmDiscard = async () => {
    setLeaving(true);
    await new Promise((r) => setTimeout(r, FADE_MS));
    await onDiscard(row.seq);
  };

  return (
    <li
      className={`min-h-16 border-b border-gray-200 px-4 py-3 transition-opacity duration-200 motion-reduce:transition-none ${leaving ? 'opacity-0' : 'opacity-100'}`}
    >
      {confirming ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-gray-900">Discard this change? It won&apos;t be saved.</p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={leaving}>
              Keep change
            </Button>
            <Button variant="danger" size="sm" onClick={confirmDiscard} disabled={leaving}>
              Discard
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3">
          <RowIcon kind={kind} />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="break-words text-sm font-semibold text-gray-900">{row.description}</p>
            <p className="flex flex-wrap items-center gap-2 text-xs font-semibold text-gray-600">
              <span className="font-normal">{row.savedAgo}</span>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${BADGE_CLASS[row.badge.kind]}`}>
                <BadgeIcon kind={row.badge.kind} />
                {row.badge.text}
              </span>
              {failed && row.attempts > 0 && <span className="font-normal">Tried {row.attempts} times</span>}
            </p>
            {failed && row.reason && <p className="text-xs text-red-800">{row.reason}</p>}
            {failed && (
              <div className="flex flex-wrap gap-2">
                {row.needsUpgrade && native && (
                  <Button variant="ghost" size="sm" onClick={() => openUpgradeSheet()}>
                    Unlock Kumaun Full
                  </Button>
                )}
                {row.canRetry && (
                  <Button variant="ghost" size="sm" onClick={() => onRetry(row.seq)}>
                    Retry change
                  </Button>
                )}
                {row.canDiscard && (
                  <Button variant="ghost" size="sm" className="text-red-700 hover:bg-red-50" onClick={() => setConfirming(true)}>
                    Discard change
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
