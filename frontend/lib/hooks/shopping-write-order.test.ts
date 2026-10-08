import { describe, it, expect } from 'vitest';
import { MutationObserver, QueryClient } from '@tanstack/react-query';
import { SHOPPING_MUTATION_SCOPE, SHOPPING_ITEM_MUTATION_KEY } from './use-shopping-list';

const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

function makeWrite(client: QueryClient, log: string[], delays: Record<string, number>) {
  return (label: string, fail = false) => {
    const observer = new MutationObserver<string, Error, string>(client, {
      mutationKey: SHOPPING_ITEM_MUTATION_KEY,
      scope: SHOPPING_MUTATION_SCOPE,
      retry: false,
      mutationFn: async (name) => {
        log.push(`start:${name}`);
        await tick(delays[name] ?? 0);
        log.push(`end:${name}`);
        if (fail) throw new Error(name);
        return name;
      },
    });
    return observer.mutate(label).catch(() => undefined);
  };
}

describe('shopping write scope', () => {
  it('runs writes one at a time in tap order, even when an earlier one is slower', async () => {
    const client = new QueryClient();
    const log: string[] = [];
    const write = makeWrite(client, log, { first: 30, second: 1, finish: 1 });

    const all = [write('first'), write('second'), write('finish')];
    // All three are pending (counted) immediately; only the first has started.
    expect(client.isMutating({ mutationKey: SHOPPING_ITEM_MUTATION_KEY })).toBe(3);
    await Promise.all(all);

    expect(log).toEqual([
      'start:first',
      'end:first',
      'start:second',
      'end:second',
      'start:finish',
      'end:finish',
    ]);
  });

  it('keeps going after an earlier write fails', async () => {
    const client = new QueryClient();
    const log: string[] = [];
    const write = makeWrite(client, log, {});
    await Promise.all([write('a', true), write('b')]);
    expect(log).toEqual(['start:a', 'end:a', 'start:b', 'end:b']);
  });
});
