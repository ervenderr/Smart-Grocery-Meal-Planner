import { API_ROUTES } from '@/lib/constants/api-routes';
import type { NewOp, OutboxOp } from '../op-types';
import type { Executor } from './types';

type Payload<K extends NewOp['kind']> = Extract<NewOp, { kind: K }>['payload'];

export const shoppingExecutors: Record<'shopping.item.create' | 'shopping.item.update' | 'shopping.item.delete', Executor> = {
  'shopping.item.create': {
    run: (op: OutboxOp, { transport }) =>
      transport.send({
        method: 'POST',
        url: API_ROUTES.SHOPPING.ITEMS,
        body: (op.payload as Payload<'shopping.item.create'>).item,
        idempotencyKey: op.idempotencyKey,
      }),
  },
  'shopping.item.update': {
    run: (op, { transport }) => {
      const { id, patch } = op.payload as Payload<'shopping.item.update'>;
      return transport.send({
        method: 'PATCH',
        url: API_ROUTES.SHOPPING.ITEM(encodeURIComponent(id)),
        body: patch,
        idempotencyKey: op.idempotencyKey,
      });
    },
  },
  'shopping.item.delete': {
    run: (op, { transport }) =>
      transport.send({
        method: 'DELETE',
        url: API_ROUTES.SHOPPING.ITEM(encodeURIComponent((op.payload as Payload<'shopping.item.delete'>).id)),
        idempotencyKey: op.idempotencyKey,
      }),
  },
};
