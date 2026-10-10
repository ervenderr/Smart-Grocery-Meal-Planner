'use client';

import { useState } from 'react';
import { Flag } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { aiApi } from '@/lib/api/ai';
import {
  MAX_REPORT_NOTE,
  REPORT_REASONS,
  buildReportSnapshot,
  mapReportError,
  type ReportKind,
  type ReportReason,
} from '@/lib/ai/report';

interface ReportSuggestionButtonProps {
  kind: ReportKind;
  item: unknown;
  refId?: string;
}

export function ReportSuggestionButton({ kind, item, refId }: ReportSuggestionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setReason('');
    setNote('');
    setError(null);
  };

  const close = () => {
    if (sending) return;
    setIsOpen(false);
    reset();
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!reason || sending) return;
    setSending(true);
    setError(null);
    try {
      await aiApi.reportSuggestion({
        kind,
        reason,
        note: note.trim() || undefined,
        refId,
        snapshot: buildReportSnapshot(item),
      });
      setIsOpen(false);
      reset();
      toast.success("Thanks, we've received your report.");
    } catch (err) {
      setError(mapReportError(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="min-h-11"
        onClick={() => setIsOpen(true)}
      >
        <Flag className="mr-2 h-4 w-4" aria-hidden="true" />
        Report suggestion
      </Button>

      <Modal isOpen={isOpen} onClose={close} title="Report this suggestion" size="sm">
        <form onSubmit={submit} className="space-y-4">
          <Select
            label="Reason"
            value={reason}
            autoFocus
            required
            disabled={sending}
            onChange={(e) => setReason(e.target.value as ReportReason | '')}
          >
            <option value="" disabled>
              Choose a reason
            </option>
            {REPORT_REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>

          <div>
            <label htmlFor="report-note" className="mb-2 block text-sm font-semibold text-gray-900">
              Details (optional)
            </label>
            <textarea
              id="report-note"
              value={note}
              maxLength={MAX_REPORT_NOTE}
              rows={4}
              disabled={sending}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-base text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
            <p className="mt-1 text-right text-sm text-gray-700" aria-live="polite">
              {note.length}/{MAX_REPORT_NOTE}
            </p>
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-500">
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={close} disabled={sending}>
              Discard report
            </Button>
            <Button type="submit" variant="primary" loading={sending} disabled={!reason}>
              Send report
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
