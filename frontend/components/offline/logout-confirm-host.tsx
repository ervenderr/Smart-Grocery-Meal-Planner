'use client';

import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { LOGOUT_PENDING_COPY } from '@/lib/offline/session/logout-guard';
import { useLogoutConfirmStore } from '@/lib/offline/session/logout-confirm-store';

/** Returns ask(decision): resolves true if the user confirms logging out. */
export function useLogoutConfirm(): (decision: { title: string; body: string }) => Promise<boolean> {
  return useLogoutConfirmStore((s) => s.ask);
}

/** Single mount point rendering the logout-with-unsynced-changes confirmation. */
export function LogoutConfirmHost() {
  const request = useLogoutConfirmStore((s) => s.request);
  const resolve = useLogoutConfirmStore((s) => s.resolve);

  return (
    <Modal isOpen={request !== null} onClose={() => resolve(false)} title={request?.title ?? LOGOUT_PENDING_COPY.title} size="sm">
      <p className="text-sm text-gray-700">{request?.body}</p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row-reverse">
        <Button variant="danger" size="md" onClick={() => resolve(true)}>
          {LOGOUT_PENDING_COPY.confirm}
        </Button>
        <Button variant="secondary" size="md" onClick={() => resolve(false)}>
          {LOGOUT_PENDING_COPY.stay}
        </Button>
      </div>
    </Modal>
  );
}
