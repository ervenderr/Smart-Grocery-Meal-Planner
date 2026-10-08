/**
 * AI orchestrator: provider call -> tolerant extract -> Zod validate ->
 * exactly one repair call -> AI_UNAVAILABLE.
 *
 * Plan 02-04 wraps runAiFeature with cache + quota; userId and cacheInputs are
 * accepted now for that purpose and intentionally unused here.
 */

import { z } from 'zod';
import { logger } from '../../config/logger.config';
import { aiUnavailableError } from './ai.errors';
import { getAiDeps } from './ai.deps';
import { extractJson } from './json-extract';
import { LlmMessage, ProviderError } from './providers/llm-provider';

export type AiFeature = 'recipes' | 'substitutions' | 'meal_plan';

export interface AiRunRequest<T> {
  readonly feature: AiFeature;
  readonly schemaVersion: number;
  readonly userId: string;
  readonly cacheInputs: unknown;
  readonly messages: readonly LlmMessage[];
  readonly schema: z.ZodType<T>;
  readonly maxTokens: number;
  readonly temperature: number;
}

type ParseResult<T> = { ok: true; data: T } | { ok: false; problems: string };

const MAX_REPLY_ECHO = 6000;
const MAX_PROBLEMS = 1500;

function parseReply<T>(text: string, schema: z.ZodType<T>): ParseResult<T> {
  let raw: unknown;
  try {
    raw = extractJson(text);
  } catch {
    return { ok: false, problems: 'No parseable JSON object was found in the reply.' };
  }
  const result = schema.safeParse(raw);
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, problems: z.prettifyError(result.error).slice(0, MAX_PROBLEMS) };
}

function repairMessages(
  original: readonly LlmMessage[],
  reply: string,
  problems: string
): readonly LlmMessage[] {
  return [
    ...original,
    { role: 'assistant', content: reply.slice(0, MAX_REPLY_ECHO) },
    {
      role: 'user',
      content:
        `Your previous reply was not valid JSON for the required schema. Problems: ${problems} ` +
        'Reply with ONLY the corrected JSON.',
    },
  ];
}

async function callProviderWithRepair<T>(req: AiRunRequest<T>): Promise<T> {
  const { provider } = getAiDeps();
  const opts = { maxTokens: req.maxTokens, temperature: req.temperature };

  const first = await provider.complete(req.messages, opts);
  const parsed = parseReply(first, req.schema);
  if (parsed.ok) return parsed.data;

  const second = await provider.complete(repairMessages(req.messages, first, parsed.problems), opts);
  const repaired = parseReply(second, req.schema);
  if (repaired.ok) return repaired.data;
  throw new ProviderError('bad_response');
}

export async function runAiFeature<T>(req: AiRunRequest<T>): Promise<{ data: T; cached: boolean }> {
  if (!getAiDeps().provider.isConfigured()) throw aiUnavailableError();
  try {
    const data = await callProviderWithRepair(req);
    return { data, cached: false };
  } catch (error) {
    const kind = error instanceof ProviderError ? error.kind : 'unexpected';
    logger.warn('AI feature failed', { feature: req.feature, kind });
    throw aiUnavailableError();
  }
}
