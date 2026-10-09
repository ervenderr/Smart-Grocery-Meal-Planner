'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { preferencesApi } from '@/lib/api/preferences';
import { getApiErrorMessage } from '@/lib/api/errors';
import { usePreferences, PREFERENCES_QUERY_KEY } from '@/lib/hooks/use-preferences';
import {
  MAX_STAPLE_LENGTH,
  addStaple,
  readStaples,
  removeStaple,
} from '@/lib/preferences/staples';

export function StaplesSettings() {
  const queryClient = useQueryClient();
  const { data, isLoading } = usePreferences();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (stapleNames: string[]) => preferencesApi.update({ stapleNames }),
    onSuccess: (result) => {
      queryClient.setQueryData(PREFERENCES_QUERY_KEY, result);
      toast.success('Staples saved');
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, "Couldn't save your staples. Try again."));
    },
  });

  if (isLoading) {
    return <p className="text-sm text-gray-600">Loading staples...</p>;
  }

  const state = readStaples(data);
  if (!state) return null;

  const { staples, defaults } = state;
  const pending = mutation.isPending;
  const matchesDefaults =
    defaults !== null &&
    defaults.length === staples.length &&
    defaults.every((name, i) => name === staples[i]);

  const handleAdd = (event: React.FormEvent) => {
    event.preventDefault();
    const result = addStaple(staples, draft);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    setDraft('');
    mutation.mutate(result.list);
  };

  const handleReset = () => {
    if (defaults === null) return;
    if (!window.confirm('Replace your staples with the default list?')) return;
    setError(null);
    mutation.mutate([...defaults]);
  };

  return (
    <Card className="p-4 sm:p-6">
      <h2 className="text-xl font-semibold text-gray-900">Staples</h2>
      <p className="mt-1 text-sm text-gray-600">
        Generated shopping lists skip these. Items you add by hand are never skipped.
      </p>

      {staples.length === 0 ? (
        <p className="mt-4 text-sm text-gray-600">
          No staples. Generated lists will include everything.
        </p>
      ) : (
        <ul className="mt-4 flex flex-wrap gap-2">
          {staples.map((name) => (
            <li
              key={name}
              className="flex items-center gap-1 rounded-full bg-gray-100 py-1 pl-4 pr-1 text-sm text-gray-900"
            >
              <span>{name}</span>
              <button
                type="button"
                aria-label={`Remove ${name} from staples`}
                disabled={pending}
                onClick={() => mutation.mutate(removeStaple(staples, name))}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-gray-600 hover:bg-gray-200 disabled:opacity-50"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="mt-4 flex items-end gap-2" noValidate>
        <div className="flex-1">
          <Input
            label="Add a staple"
            value={draft}
            maxLength={MAX_STAPLE_LENGTH}
            disabled={pending}
            onChange={(e) => {
              setDraft(e.target.value);
              if (error) setError(null);
            }}
          />
        </div>
        <Button type="submit" disabled={pending} className="min-h-11 min-w-11">
          Add
        </Button>
      </form>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="mt-4">
        <Button
          type="button"
          variant="outline"
          disabled={pending || defaults === null || matchesDefaults}
          onClick={handleReset}
          className="min-h-11"
        >
          Reset to defaults
        </Button>
      </div>
    </Card>
  );
}
