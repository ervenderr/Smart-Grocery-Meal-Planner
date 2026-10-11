import { API_ROUTES } from '@/lib/constants/api-routes';
import type { NewOp } from '../op-types';
import type { Executor } from './types';

export const shoppingFinishExecutor: Executor = {
  run: (op, { transport }) =>
    transport.send({
      method: 'POST',
      url: API_ROUTES.SHOPPING.FINISH,
      body: (op.payload as Extract<NewOp, { kind: 'shopping.finish' }>['payload']).input,
      idempotencyKey: op.idempotencyKey,
    }),
};
