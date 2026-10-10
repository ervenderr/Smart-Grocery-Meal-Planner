import { logger } from '../src/config/logger.config';
import { prisma } from '../src/config/database.config';

const mockSchedule = jest.fn();
jest.mock('node-cron', () => ({ schedule: (...args: unknown[]) => mockSchedule(...args) }));

import {
  initializeSyncCleanup,
  SYNC_CLEANUP_CRON,
} from '../src/modules/idempotency/idempotency.cleanup';

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('initializeSyncCleanup', () => {
  it('schedules the daily cron and runs the prune from the callback', async () => {
    const info = jest.spyOn(logger, 'info').mockImplementation(() => logger);
    jest.spyOn(prisma.idempotencyKey, 'deleteMany').mockResolvedValue({ count: 2 } as never);
    jest.spyOn(prisma.refreshToken, 'deleteMany').mockResolvedValue({ count: 3 } as never);

    initializeSyncCleanup();

    expect(mockSchedule).toHaveBeenCalledWith(SYNC_CLEANUP_CRON, expect.any(Function));
    const callback = mockSchedule.mock.calls[0][1] as () => void;
    callback();
    await flush();

    expect(info).toHaveBeenCalledWith(
      'Sync cleanup complete',
      expect.objectContaining({ idempotencyKeys: 2, refreshTokens: 3 })
    );
  });

  it('logs an error instead of throwing when the prune fails', async () => {
    jest.spyOn(logger, 'info').mockImplementation(() => logger);
    const error = jest.spyOn(logger, 'error').mockImplementation(() => logger);
    jest.spyOn(prisma.idempotencyKey, 'deleteMany').mockRejectedValue(new Error('db down') as never);
    jest.spyOn(prisma.refreshToken, 'deleteMany').mockResolvedValue({ count: 0 } as never);

    initializeSyncCleanup();
    const callback = mockSchedule.mock.calls[0][1] as () => void;
    callback();
    await flush();

    expect(error).toHaveBeenCalledWith(
      'Sync cleanup failed',
      expect.objectContaining({ error: 'db down' })
    );
  });

  it('warns and disables cleanup when scheduling throws', () => {
    jest.spyOn(logger, 'info').mockImplementation(() => logger);
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => logger);
    mockSchedule.mockImplementation(() => {
      throw new Error('no cron');
    });

    expect(() => initializeSyncCleanup()).not.toThrow();
    expect(warn).toHaveBeenCalledWith(
      'node-cron unavailable, sync cleanup disabled',
      expect.objectContaining({ error: 'no cron' })
    );
  });
});
