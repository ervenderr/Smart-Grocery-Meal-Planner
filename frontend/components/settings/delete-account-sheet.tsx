'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { haptic } from '@/lib/native/native-haptics';
import { accountApi } from '@/lib/api/account';
import { useAuthStore } from '@/lib/stores/auth-store';
import { ENTITLEMENT_COPY } from '@/lib/entitlements/copy';
import {
  canSubmitDelete,
  classifyDeleteError,
  DELETE_ACCOUNT_MESSAGES,
  DELETED_LOGIN_PATH,
  markAccountDeleted,
} from '@/lib/account/delete-account';

interface DeleteAccountSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DeleteAccountFormProps {
  onClose: () => void;
  onBusyChange: (busy: boolean) => void;
}

/** Mounted only while the sheet is open, so password and error state reset on close. */
function DeleteAccountForm({ onClose, onBusyChange }: DeleteAccountFormProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);

  // The form mounts only when the sheet opens: one warning tap per open.
  useEffect(() => {
    haptic('warning');
  }, []);

  // Initial focus goes to the password field, never the danger button.
  useEffect(() => {
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting || !canSubmitDelete(password)) return;

    setSubmitting(true);
    onBusyChange(true);
    setFieldError(null);
    setBannerError(null);

    try {
      await accountApi.deleteAccount(password);
    } catch (error) {
      const kind = classifyDeleteError(error);
      setSubmitting(false);
      onBusyChange(false);
      if (kind === 'wrong_password') {
        setFieldError(DELETE_ACCOUNT_MESSAGES.wrong_password);
        window.setTimeout(() => inputRef.current?.focus(), 0);
      } else {
        setBannerError(DELETE_ACCOUNT_MESSAGES[kind]);
      }
      return;
    }

    setPassword('');
    markAccountDeleted();
    useAuthStore.getState().clearAuth();
    router.replace(DELETED_LOGIN_PATH);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <p className="text-sm text-gray-700">
        This permanently deletes your pantry, recipes, meal plans, shopping lists, budget and AI
        usage. This can&apos;t be undone.
      </p>
      <p className="text-sm text-gray-700">{ENTITLEMENT_COPY.deleteAccountNote}</p>

      <Input
        ref={inputRef}
        type="password"
        label="Enter your password to confirm"
        autoComplete="current-password"
        autoFocus
        value={password}
        disabled={submitting}
        error={fieldError ?? undefined}
        onChange={(e) => {
          setPassword(e.target.value);
          if (fieldError) setFieldError(null);
        }}
      />

      {bannerError && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {bannerError}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Button
          type="submit"
          variant="danger"
          className="min-h-11 w-full"
          loading={submitting}
          disabled={!canSubmitDelete(password)}
        >
          Delete account permanently
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="min-h-11 w-full"
          disabled={submitting}
          onClick={onClose}
        >
          Keep my account
        </Button>
      </div>
    </form>
  );
}

export function DeleteAccountSheet({ isOpen, onClose }: DeleteAccountSheetProps) {
  const [busy, setBusy] = useState(false);

  const handleClose = () => {
    if (busy) return;
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Delete your account?" size="sm">
      <DeleteAccountForm onClose={handleClose} onBusyChange={setBusy} />
    </Modal>
  );
}
