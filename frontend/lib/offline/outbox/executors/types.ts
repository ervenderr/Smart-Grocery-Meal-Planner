import type { Transport } from '../../transport';
import type { OutboxOp } from '../op-types';
import type { OutboxStore } from '../store';

export interface ExecutorContext {
  transport: Transport;
  store: OutboxStore;
}

/** Returns the server result (used to patch the cache); rejects with TransportFailure. */
export interface Executor {
  run(op: OutboxOp, ctx: ExecutorContext): Promise<unknown>;
}
