import type { OpKind } from '../op-types';
import { pantryExecutors } from './pantry';
import { shoppingExecutors } from './shopping';
import type { Executor } from './types';

export interface ExecutorRegistry {
  get(kind: OpKind): Executor | null;
}

export function createExecutorRegistry(extra: Partial<Record<OpKind, Executor>> = {}): ExecutorRegistry {
  const table: Partial<Record<OpKind, Executor>> = { ...shoppingExecutors, ...pantryExecutors, ...extra };
  return { get: (kind) => table[kind] ?? null };
}

export type { Executor, ExecutorContext } from './types';
