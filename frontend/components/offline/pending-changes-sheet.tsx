'use client';

import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Check } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common/empty-state';
import { haptic } from '@/lib/native/native-haptics';
import { useAuthStore } from '@/lib/stores/auth-store';
import { getOfflineRuntime } from '@/lib/offline/runtime';
import { buildSheetModel } from '@/lib/offline/status/sheet-model';
import { discardAllFailed, discardOp, retryAll, retryOp } from '@/lib/offline/status/actions';
import { usePendingSheet } from '@/lib/offline/status/sheet-store';
import { useOfflineStatus } from '@/lib/offline/status/use-offline-status';
import { PendingChangeRow } from './pending-change-row';

const UNDONE = "Couldn't save that change. It was undone.";

export function PendingChangesSheet() {
  const open = usePendingSheet((s) => s.open);
  const setOpen = usePendingSheet((s) => s.setOpen);
  const status = useOfflineStatus();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const [confirmAll, setConfirmAll] = useState(false);

  const model = useMemo(
    () =>
      status
        ? buildSheetModel({ ops: status.ops, connectivity: status.connectivity, draining: status.draining, bootstrapping: false })
        : null,
    [status],
  );
  const kinds = useMemo(() => new Map((status?.ops ?? []).map((o) => [o.seq, o.kind] as const)), [status]);

  if (!status || !model) return null;

  const close = () => {
    setConfirmAll(false);
    setOpen(false);
  };
  const run = (fn: (rt: NonNullable<ReturnType<typeof getOfflineRuntime>>) => Promise<unknown>) => {
    const rt = getOfflineRuntime();
    if (rt) void fn(rt).catch(() => toast.error("Couldn't update pending changes. Try again."));
  };
  const handleDiscard = async (seq: number) => {
    const rt = getOfflineRuntime();
    if (!rt) return;
    await discardOp(rt, seq);
    toast(UNDONE);
  };
  const handleDiscardAll = () => {
    setConfirmAll(false);
    run(async (rt) => {
      if (!userId) return;
      await discardAllFailed(rt, userId);
      toast(UNDONE);
    });
  };

  return (
    <Modal isOpen={open} onClose={close} title="Pending changes" size="md">
      <div className="flex flex-col gap-6">
        <p className="text-sm text-gray-600">{model.summary}</p>

        {model.empty && (
          <EmptyState icon={Check} headingLevel="h3" title={model.empty.heading} description={model.empty.body} />
        )}

        {model.attention.length > 0 && (
          <section aria-labelledby="pending-attention">
            <h3 id="pending-attention" className="flex items-center gap-2 text-xl font-semibold text-gray-900">
              Needs attention
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-800">{model.attention.length}</span>
            </h3>
            <ul className="mt-2 list-none">
              {model.attention.map((row) => (
                <PendingChangeRow
                  key={row.seq}
                  row={row}
                  kind={kinds.get(row.seq)}
                  onRetry={(seq) => {
                    haptic('light');
                    run((rt) => retryOp(rt, seq));
                  }}
                  onDiscard={handleDiscard}
                />
              ))}
            </ul>
          </section>
        )}

        {model.waiting.length > 0 && (
          <section aria-labelledby="pending-waiting">
            <h3 id="pending-waiting" className="text-xl font-semibold text-gray-900">
              Waiting to sync
            </h3>
            <ul className="mt-2 list-none">
              {model.waiting.map((row) => (
                <PendingChangeRow key={row.seq} row={row} kind={kinds.get(row.seq)} onRetry={() => undefined} onDiscard={handleDiscard} />
              ))}
            </ul>
          </section>
        )}

        {(model.showRetryAll || model.showDiscardAll) && (
          <div className="sticky bottom-0 -mx-4 flex flex-col gap-2 border-t border-gray-200 bg-white px-4 py-3 sm:-mx-6 sm:px-6">
            {confirmAll ? (
              <>
                <p className="text-sm font-semibold text-gray-900">
                  Discard {model.failedCount} failed {model.failedCount === 1 ? 'change' : 'changes'}? They won&apos;t be saved.
                </p>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setConfirmAll(false)}>
                    Keep
                  </Button>
                  <Button variant="danger" size="sm" onClick={handleDiscardAll}>
                    Discard {model.failedCount}
                  </Button>
                </div>
              </>
            ) : (
              <>
                {model.showRetryAll && (
                  <Button
                    variant="primary"
                    onClick={() => {
                      haptic('light');
                      run(async (rt) => {
                        if (userId) await retryAll(rt, userId);
                      });
                    }}
                  >
                    Retry all
                  </Button>
                )}
                {model.showDiscardAll && (
                  <Button variant="ghost" className="text-red-700 hover:bg-red-50" onClick={() => setConfirmAll(true)}>
                    Discard all failed
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
