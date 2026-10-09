'use client';

import { useEffect, useState } from 'react';
import { UsedUpBadge } from '@/components/pantry/used-up-badge';
import { formatQuantity } from '@/lib/pantry/quantity';
import { clampUse, leftFor } from '@/lib/cook/preview';
import type { CookRow } from '@/types/cook.types';

interface CookPreviewRowsProps {
  rows: readonly CookRow[];
  uses: Readonly<Record<string, number>>;
  onUseChange: (key: string, value: number) => void;
  disabled: boolean;
  /** Row whose Use input should receive focus (set by "Enter amount"). */
  focusKey: string | null;
}

const INPUT_CLASS =
  'h-11 w-full rounded-lg border border-gray-300 bg-white px-2 text-base text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:bg-gray-100';

function focusVisibleInput(key: string) {
  for (const layout of ['card', 'table']) {
    const el = document.getElementById(`cook-use-${layout}-${key}`);
    if (el && el.offsetParent !== null) {
      el.focus();
      return;
    }
  }
}

export function CookPreviewRows({ rows, uses, onUseChange, disabled, focusKey }: CookPreviewRowsProps) {
  const [drafts, setDrafts] = useState<Readonly<Record<string, string>>>({});
  const [messages, setMessages] = useState<Readonly<Record<string, string>>>({});

  useEffect(() => {
    if (focusKey) focusVisibleInput(focusKey);
  }, [focusKey]);

  const usedOf = (row: CookRow) => uses[row.key] ?? row.use;
  const draftOf = (row: CookRow) => drafts[row.key] ?? formatQuantity(usedOf(row));

  const handleChange = (row: CookRow, raw: string) => {
    const result = clampUse(raw, row.have);
    const message =
      result.error === 'negative'
        ? 'Enter 0 or more.'
        : result.error === 'invalid'
          ? 'Enter a number.'
          : result.clamped
            ? `Only ${formatQuantity(row.have)} ${row.unit} in your pantry.`
            : '';
    setDrafts((d) => ({ ...d, [row.key]: result.clamped ? formatQuantity(result.value) : raw }));
    setMessages((m) => ({ ...m, [row.key]: message }));
    if (!result.error) onUseChange(row.key, result.value);
  };

  const noteFor = (row: CookRow) => {
    if (messages[row.key]) return { text: messages[row.key], tone: 'text-red-600' };
    if (row.status === 'short') {
      return {
        text: `Only ${formatQuantity(row.have)} ${row.unit} in your pantry. Using all of it.`,
        tone: 'text-amber-800',
      };
    }
    return null;
  };

  const renderInput = (row: CookRow, layout: 'card' | 'table') => (
    <input
      id={`cook-use-${layout}-${row.key}`}
      type="text"
      inputMode="decimal"
      value={draftOf(row)}
      disabled={disabled}
      aria-label={`Use ${row.name} (${row.unit})`}
      aria-invalid={Boolean(messages[row.key])}
      onChange={(e) => handleChange(row, e.target.value)}
      className={INPUT_CLASS}
    />
  );

  const renderLeft = (row: CookRow) => {
    const left = leftFor(row.have, usedOf(row));
    return (
      <span className="flex flex-wrap items-center gap-2 font-semibold text-gray-900">
        {formatQuantity(left)} {row.unit}
        {left === 0 && <UsedUpBadge />}
      </span>
    );
  };

  return (
    <div>
      <ul role="list" className="space-y-2 sm:hidden">
        {rows.map((row) => {
          const note = noteFor(row);
          return (
            <li key={row.key} className="space-y-2 rounded-lg border border-gray-200 p-4">
              <p className="truncate text-base font-semibold text-gray-900">{row.name}</p>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="text-gray-600">Have</p>
                  <p className="text-gray-900">
                    {formatQuantity(row.have)} {row.unit}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Use</p>
                  {renderInput(row, 'card')}
                </div>
                <div>
                  <p className="text-gray-600">Left</p>
                  {renderLeft(row)}
                </div>
              </div>
              {note && (
                <p role="alert" className={`text-sm ${note.tone}`}>
                  {note.text}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <table className="hidden w-full text-left text-sm sm:table">
        <thead>
          <tr className="border-b border-gray-200 text-gray-600">
            <th scope="col" className="py-2 pr-2 font-semibold">Item</th>
            <th scope="col" className="py-2 pr-2 font-semibold">Have</th>
            <th scope="col" className="py-2 pr-2 font-semibold">Use</th>
            <th scope="col" className="py-2 font-semibold">Left</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const note = noteFor(row);
            return (
              <tr key={row.key} className="border-b border-gray-100 align-top">
                <td className="max-w-[10rem] truncate py-3 pr-2 text-base font-semibold text-gray-900">
                  {row.name}
                </td>
                <td className="py-3 pr-2 text-gray-900">
                  {formatQuantity(row.have)} {row.unit}
                </td>
                <td className="w-32 py-3 pr-2">
                  {renderInput(row, 'table')}
                  {note && <p className={`mt-1 text-sm ${note.tone}`}>{note.text}</p>}
                </td>
                <td className="py-3">{renderLeft(row)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
