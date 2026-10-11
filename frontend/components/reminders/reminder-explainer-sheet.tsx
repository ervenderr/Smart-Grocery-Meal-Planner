'use client';

import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Bell, BellRing, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { haptic } from '@/lib/native/native-haptics';
import { useReminders } from '@/lib/reminders/use-reminders';

export type ExplainerState = 'intro' | 'denied';

interface ReminderExplainerSheetProps {
  open: boolean;
  onClose: () => void;
  initialState?: ExplainerState;
}

const CTA_CLASS = 'w-full bg-primary-600 hover:bg-primary-700 active:bg-primary-700';

/**
 * Opt-in explainer shown before the iOS permission prompt (Apple 5.1.2(i)).
 * After a successful opt-in the saved prefs change announces itself and the
 * ReminderRuntime reschedules immediately; no callback is needed here.
 */
export function ReminderExplainerSheet({
  open,
  onClose,
  initialState = 'intro',
}: ReminderExplainerSheetProps) {
  const { enable, openSettings, snooze } = useReminders();
  const [state, setState] = useState<ExplainerState>(initialState);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setState(initialState);
  }, [open, initialState]);

  const handleEnable = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await enable();
      if (result === 'granted') {
        onClose();
        void haptic('success');
        toast.success('Reminders are on');
      } else {
        setState('denied');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSnooze = () => {
    snooze();
    onClose();
  };

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-gray-900/50 backdrop-blur-sm" />
        <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center">
          <Dialog.Content
            data-testid="reminders-explainer"
            aria-describedby={undefined}
            className="pointer-events-auto relative flex max-h-[85dvh] w-full flex-col gap-4 overflow-y-auto rounded-t-2xl bg-white p-6 pb-safe shadow-xl animate-slide-up focus:outline-none sm:max-w-md"
          >
            <div className="flex items-center justify-between">
              <div className="mx-auto h-1 w-12 rounded-full bg-gray-300" aria-hidden="true" />
              <Dialog.Close
                aria-label="Close"
                className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 active:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </Dialog.Close>
            </div>

            {state === 'intro' ? (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50">
                  <BellRing className="h-6 w-6 text-primary-600" aria-hidden="true" />
                </div>
                <Dialog.Title className="text-xl font-semibold text-gray-900">
                  Never waste food by surprise
                </Dialog.Title>
                <p className="text-base text-gray-600">
                  Kitcha can remind you before things in your pantry expire. Reminders are set up on
                  your phone and work even offline.
                </p>
                <Card className="flex items-start gap-3 bg-gray-50 p-4">
                  <Bell className="mt-0.5 h-5 w-5 shrink-0 text-gray-500" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Milk expires tomorrow.</p>
                    <p className="text-base text-gray-600">Plan to use it today.</p>
                  </div>
                </Card>
                <Button
                  size="lg"
                  data-testid="reminders-enable"
                  className={CTA_CLASS}
                  loading={busy}
                  onClick={() => void handleEnable()}
                >
                  Turn on reminders
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  data-testid="reminders-snooze"
                  className="w-full"
                  disabled={busy}
                  onClick={handleSnooze}
                >
                  Not now
                </Button>
                <p className="text-base text-gray-500">You can change this anytime in Settings.</p>
              </>
            ) : (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50">
                  <BellRing className="h-6 w-6 text-primary-600" aria-hidden="true" />
                </div>
                <Dialog.Title className="text-xl font-semibold text-gray-900">
                  Reminders are off
                </Dialog.Title>
                <p className="text-base text-gray-600">
                  Turn on notifications for Kitcha in iOS Settings to get expiry reminders.
                </p>
                <Button size="lg" className={CTA_CLASS} onClick={() => void openSettings()}>
                  Open Settings
                </Button>
                <Button size="lg" variant="ghost" className="w-full" onClick={onClose}>
                  Close
                </Button>
              </>
            )}
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
