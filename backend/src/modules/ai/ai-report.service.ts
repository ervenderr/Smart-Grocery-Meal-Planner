import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database.config';
import type { AiReportInput } from './ai-report.schema';

export async function createAiReport(
  userId: string,
  input: AiReportInput
): Promise<{ id: string; createdAt: Date }> {
  return prisma.aiReport.create({
    data: {
      userId,
      kind: input.kind,
      reason: input.reason,
      note: input.note || null,
      refId: input.refId ?? null,
      snapshot: input.snapshot as Prisma.InputJsonObject,
    },
    select: { id: true, createdAt: true },
  });
}
