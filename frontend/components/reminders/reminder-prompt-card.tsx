'use client';

import { useState } from 'react';
import { BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { usePantryList } from '@/lib/hooks/use-pantry';
import { useReminders } from '@/lib/reminders/use-reminders';
import { ReminderExplainerSheet } from './reminder-explainer-sheet';

/** Dismissible dashboard card inviting native users to opt in to expiry reminders. */
export function ReminderPromptCard() {
  const { native, permission, snoozed, snooze } = useReminders();
  const { data: items } = usePantryList({});
  const [open, setOpen] = useState(false);

  const canAsk = permission === 'prompt' || permission === 'prompt-with-rationale';
  const hasExpiry = (items ?? []).some((item) => Boolean(item.expiryDate));

  if (!native) return null;

  const showCard = canAsk && !snoozed && hasExpiry;

  // One stable tree so the sheet keeps its denied state after the permission changes.
  return (
    <>
      {showCard && (
        <Card className="flex flex-col gap-3 border-primary-200 bg-primary-50 p-4">
          <div className="flex items-start gap-3">
            <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-primary-600" aria-hidden="true" />
            <div>
              <h3 className="text-base font-semibold text-gray-900">Never waste food by surprise</h3>
              <p className="text-base text-gray-600">Get a reminder before pantry items expire.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              className="flex-1 bg-primary-600 hover:bg-primary-700 active:bg-primary-700"
              onClick={() => setOpen(true)}
            >
              Turn on reminders
            </Button>
            <Button variant="ghost" className="flex-1" onClick={snooze}>
              Not now
            </Button>
          </div>
        </Card>
      )}
      <ReminderExplainerSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
