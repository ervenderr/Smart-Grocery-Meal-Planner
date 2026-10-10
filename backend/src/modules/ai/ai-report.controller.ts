import type { Request, Response } from 'express';
import { AppError } from '../../middleware/errorHandler';
import { aiReportBodySchema } from './ai-report.schema';
import { createAiReport } from './ai-report.service';

/** POST /api/v1/ai/reports. Note and snapshot are never logged. */
export async function createReport(req: Request, res: Response): Promise<void> {
  const parsed = aiReportBodySchema.safeParse(req.body);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join('.') || 'body'}: ${i.message}`)
      .join('; ');
    throw new AppError(`Validation failed: ${issues}`, 400, true, { code: 'VALIDATION_ERROR' });
  }

  const userId = (req as Request & { user: { id: string } }).user.id;
  const report = await createAiReport(userId, parsed.data);
  res.status(201).json({ id: report.id, createdAt: report.createdAt });
}
