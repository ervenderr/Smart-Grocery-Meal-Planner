import { API_ROUTES } from '@/lib/constants/api-routes';
import type { NewOp } from '../op-types';
import type { Executor } from './types';

type Payload<K extends NewOp['kind']> = Extract<NewOp, { kind: K }>['payload'];
const enc = encodeURIComponent;

export const pantryExecutors: Record<'pantry.create' | 'pantry.adjust' | 'pantry.update' | 'pantry.delete', Executor> = {
  'pantry.create': {
    run: (op, { transport }) =>
      transport.send({
        method: 'POST',
        url: API_ROUTES.PANTRY.BASE,
        body: (op.payload as Payload<'pantry.create'>).item,
        idempotencyKey: op.idempotencyKey,
      }),
  },
  'pantry.adjust': {
    run: (op, { transport }) => {
      const { id, delta } = op.payload as Payload<'pantry.adjust'>;
      return transport.send({
        method: 'POST',
        url: API_ROUTES.PANTRY.ADJUST(enc(id)),
        body: { delta },
        idempotencyKey: op.idempotencyKey,
      });
    },
  },
  'pantry.update': {
    run: (op, { transport }) => {
      const { id, patch } = op.payload as Payload<'pantry.update'>;
      return transport.send({
        method: 'PATCH',
        url: API_ROUTES.PANTRY.BY_ID(enc(id)),
        body: patch,
        idempotencyKey: op.idempotencyKey,
      });
    },
  },
  'pantry.delete': {
    run: (op, { transport }) =>
      transport.send({
        method: 'DELETE',
        url: API_ROUTES.PANTRY.BY_ID(enc((op.payload as Payload<'pantry.delete'>).id)),
        idempotencyKey: op.idempotencyKey,
      }),
  },
};
