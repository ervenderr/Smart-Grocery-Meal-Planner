'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { ReminderExplainerSheet, type ExplainerState } from '@/components/reminders/reminder-explainer-sheet';
import { usePantryList } from '@/lib/hooks/use-pantry';
import { readHapticsEnabled, writeHapticsEnabled } from '@/lib/native/haptic-prefs';
import { filterExpiring } from '@/lib/pantry/expiring-filter';
import { REMINDER_TIME_OPTIONS, toggleOffset } from '@/lib/reminders/prefs';
import type { ReminderOffset } from '@/lib/reminders/types';
import { useReminders } from '@/lib/reminders/use-reminders';

const OFFSET_CHIPS: readonly { offset: ReminderOffset; label: string }[] = [
  { offset: 0, label: 'Morning of expiry' },
  { offset: 1, label: '1 day before' },
  { offset: 2, label: '2 days before' },
  { offset: 3, label: '3 days before' },
];

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2';

/** 'HH:MM' (24h) to a 12-hour label such as '9:00 AM'. */
export function formatTimeLabel(time: string): string {
  const [hh, mm] = time.split(':').map(Number);
  const suffix = hh >= 12 ? 'PM' : 'AM';
  const hour = hh % 12 === 0 ? 12 : hh % 12;
  return `${hour}:${String(mm).padStart(2, '0')} ${suffix}`;
}

function Switch({
  label,
  checked,
  onToggle,
  testId,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
  testId?: string;
}) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4">
      <span className="text-base text-gray-900">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        data-testid={testId}
        onClick={onToggle}
        className={`relative h-11 w-14 shrink-0 rounded-full transition-colors active:opacity-80 ${FOCUS_RING}`}
      >
        <span
          aria-hidden="true"
          className={`absolute left-0 top-1/2 h-7 w-14 -translate-y-1/2 rounded-full transition-colors ${
            checked ? 'bg-primary-600' : 'bg-gray-300'
          }`}
        />
        <span
          aria-hidden="true"
          className={`absolute top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-white shadow transition-all ${
            checked ? 'left-[30px]' : 'left-1'
          }`}
        />
      </button>
    </div>
  );
}

/** Settings > Device: reminders and haptics. Rendered only on native. */
export function NativeSettings() {
  const { permission, prefs, updatePrefs, openSettings } = useReminders();
  const { data: items } = usePantryList({});
  const [explainer, setExplainer] = useState<{ open: boolean; state: ExplainerState }>({
    open: false,
    state: 'intro',
  });
  const [offsetError, setOffsetError] = useState(false);
  const [haptics, setHaptics] = useState(true);

  useEffect(() => {
    setHaptics(readHapticsEnabled(window.localStorage));
  }, []);

  const hasExpiring = useMemo(() => filterExpiring(items ?? [], new Date()).length > 0, [items]);
  const denied = permission === 'denied';
  const granted = permission === 'granted';
  const remindersOn = prefs.enabled && granted;

  const handleReminderSwitch = () => {
    if (remindersOn) {
      updatePrefs({ ...prefs, enabled: false });
      return;
    }
    if (granted) {
      updatePrefs({ ...prefs, enabled: true });
      return;
    }
    setExplainer({ open: true, state: denied ? 'denied' : 'intro' });
  };

  const handleOffset = (offset: ReminderOffset) => {
    const result = toggleOffset(prefs, offset);
    setOffsetError(result.blocked);
    if (!result.blocked) updatePrefs(result.prefs);
  };

  const handleHaptics = () => {
    const next = !haptics;
    setHaptics(next);
    writeHapticsEnabled(window.localStorage, next);
  };

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-4 sm:p-6">
        <h2 className="text-xl font-semibold text-gray-900">Reminders</h2>

        <Switch
          label="Expiry reminders"
          checked={remindersOn}
          onToggle={handleReminderSwitch}
          testId="reminders-switch"
        />

        {denied && (
          <div className="space-y-1">
            <p className="text-base text-gray-600">Notifications are blocked in iOS Settings.</p>
            <button
              type="button"
              onClick={() => void openSettings()}
              className={`min-h-11 rounded-lg px-1 text-sm font-semibold text-primary-700 active:bg-gray-100 ${FOCUS_RING}`}
            >
              Open Settings
            </button>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-900">Remind me</p>
          <div role="group" aria-label="Remind me" className="flex flex-wrap gap-2">
            {OFFSET_CHIPS.map(({ offset, label }) => {
              const active = prefs.offsets.includes(offset);
              return (
                <button
                  key={offset}
                  type="button"
                  aria-pressed={active}
                  onClick={() => handleOffset(offset)}
                  className={`h-11 rounded-full border px-4 text-sm font-semibold active:opacity-80 ${FOCUS_RING} ${
                    active
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-300 bg-white text-gray-700'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {offsetError && (
            <p role="alert" className="text-base text-red-600">
              Keep at least one reminder time
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="reminder-time" className="text-sm font-semibold text-gray-900">
            Reminder time
          </label>
          <select
            id="reminder-time"
            value={prefs.time}
            onChange={(e) => updatePrefs({ ...prefs, time: e.target.value })}
            className={`block h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-base text-gray-900 ${FOCUS_RING}`}
          >
            {REMINDER_TIME_OPTIONS.map((time) => (
              <option key={time} value={time}>
                {formatTimeLabel(time)}
              </option>
            ))}
          </select>
        </div>

        {!hasExpiring && (
          <div className="rounded-lg bg-gray-50 p-4">
            <h3 className="text-base font-semibold text-gray-900">Nothing expiring soon</h3>
            <p className="text-base text-gray-600">
              Add items with expiry dates to your pantry and Kitcha will remind you before they go off.
            </p>
          </div>
        )}
      </Card>

      <Card className="space-y-2 p-4 sm:p-6">
        <h2 className="text-xl font-semibold text-gray-900">Haptics</h2>
        <Switch label="Haptics" checked={haptics} onToggle={handleHaptics} testId="haptics-switch" />
      </Card>

      <ReminderExplainerSheet
        open={explainer.open}
        initialState={explainer.state}
        onClose={() => setExplainer((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
}
