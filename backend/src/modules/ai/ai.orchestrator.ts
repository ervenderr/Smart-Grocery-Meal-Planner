/**
 * AI orchestrator: provider call -> tolerant extract -> Zod validate ->
 * exactly one repair call -> AI_UNAVAILABLE.
 *
 * runAiFeature wraps that with the cache and quota: cache hit (free, no quota)
 * -> atomic reserve -> provider -> validated payload cached; failures refund.
 */

import { z } from 'zod';
import { logger } from '../../config/logger.config';
import { aiQuotaExceededError, aiUnavailableError } from './ai.errors';
import { getAiDeps } from './ai.deps';
import { buildCacheKey } from './ai-cache-key';
import { getCachedSafe, pruneExpired, setCachedSafe } from './ai-cache.repository';
import {
  QuotaExceededError,
  nextUtcMidnight,
  pruneOldUsage,
  refundQuota,
  reserveQuota,
  utcDay,
} from './ai-quota.repository';
import { extractJson, stripReasoning } from './json-extract';
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
  /** Bypass the cache read (quota is still consumed); the fresh result replaces the cached one. */
  readonly skipCache?: boolean;
  /** Return false to keep a result out of the cache (e.g. empty lists). Default: always cache. */
  shouldCache?(data: T): boolean;
}

type ParseResult<T> = { ok: true; data: T } | { ok: false; problems: string };

const MAX_REPLY_ECHO = 6000;
const MAX_PROBLEMS = 1500;
/** A repair call is skipped when less than this remains of the total budget. */
const MIN_REPAIR_BUDGET_MS = 3000;

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

/** Echo only the answer (reasoning removed), keeping the tail where the JSON ends. */
function echoReply(reply: string): string {
  const answer = stripReasoning(reply).trim();
  return answer.length > 0 ? answer.slice(-MAX_REPLY_ECHO) : '(no JSON was produced)';
}

function repairMessages(
  original: readonly LlmMessage[],
  reply: string,
  problems: string
): readonly LlmMessage[] {
  return [
    ...original,
    { role: 'assistant', content: echoReply(reply) },
    {
      role: 'user',
      content:
        `Your previous reply was not valid JSON for the required schema. Problems: ${problems} ` +
        'Reply with ONLY the corrected JSON.',
    },
  ];
}

async function callProviderWithRepair<T>(req: AiRunRequest<T>): Promise<T> {
  const { provider, totalTimeoutMs } = getAiDeps();
  const deadline = Date.now() + totalTimeoutMs;
  const base = { maxTokens: req.maxTokens, temperature: req.temperature };

  const first = await provider.complete(req.messages, { ...base, timeoutMs: totalTimeoutMs });
  const parsed = parseReply(first, req.schema);
  if (parsed.ok) return parsed.data;

  const remaining = deadline - Date.now();
  if (remaining < MIN_REPAIR_BUDGET_MS) throw new ProviderError('timeout');
  const second = await provider.complete(repairMessages(req.messages, first, parsed.problems), {
    ...base,
    timeoutMs: remaining,
  });
  const repaired = parseReply(second, req.schema);
  if (repaired.ok) return repaired.data;
  throw new ProviderError('bad_response');
}

const HOUR_MS = 3_600_000;
const CACHE_TTL_MS: Record<AiFeature, number> = {
  recipes: 24 * HOUR_MS,
  meal_plan: 24 * HOUR_MS,
  substitutions: 7 * 24 * HOUR_MS,
};
const PRUNE_ONE_IN = 20;
const USAGE_KEEP_DAYS = 14;

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function readCache<T>(key: string, now: Date, schema: z.ZodType<T>): Promise<T | null> {
  const stored = await getCachedSafe(key, now);
  if (stored === null) return null;
  const parsed = schema.safeParse(stored);
  return parsed.success ? parsed.data : null;
}

async function reserveOrThrow(req: AiRunRequest<unknown>, now: Date): Promise<string> {
  const day = utcDay(now);
  const { limits } = getAiDeps();
  try {
    const counts = await reserveQuota({
      userId: req.userId,
      day,
      userLimit: limits.userDaily,
      globalLimit: limits.globalDaily,
    });
    logger.info('AI quota reserved', { feature: req.feature, ...counts });
    return day;
  } catch (error) {
    if (error instanceof QuotaExceededError) {
      throw aiQuotaExceededError({
        scope: error.scope,
        limit: error.limit,
        resetsAt: nextUtcMidnight(now),
      });
    }
    logger.error('AI quota reserve failed', { feature: req.feature, error: describeError(error) });
    throw aiUnavailableError();
  }
}

async function safeRefund(userId: string, day: string): Promise<void> {
  try {
    await refundQuota({ userId, day });
  } catch (error) {
    logger.error('AI quota refund failed', { error: describeError(error) });
  }
}

function pruneSometimes(now: Date): void {
  if (Math.floor(Math.random() * PRUNE_ONE_IN) !== 0) return;
  Promise.all([pruneExpired(now), pruneOldUsage(now, USAGE_KEEP_DAYS)]).catch((error) =>
    logger.warn('AI housekeeping failed', { error: describeError(error) })
  );
}

async function storeResult<T>(req: AiRunRequest<T>, key: string, data: T, now: Date): Promise<void> {
  const stored = await setCachedSafe({
    key,
    feature: req.feature,
    schemaVersion: req.schemaVersion,
    payload: data,
    ttlMs: CACHE_TTL_MS[req.feature],
    now,
  });
  if (stored) pruneSometimes(now);
}

async function generate<T>(req: AiRunRequest<T>, day: string): Promise<T> {
  try {
    return await callProviderWithRepair(req);
  } catch (error) {
    await safeRefund(req.userId, day);
    const kind = error instanceof ProviderError ? error.kind : 'unexpected';
    logger.warn('AI feature failed', { feature: req.feature, kind });
    throw aiUnavailableError();
  }
}

export async function runAiFeature<T>(req: AiRunRequest<T>): Promise<{ data: T; cached: boolean }> {
  const deps = getAiDeps();
  if (!deps.provider.isConfigured()) throw aiUnavailableError();

  const now = deps.now();
  const key = buildCacheKey(req.feature, req.schemaVersion, req.cacheInputs);
  const hit = req.skipCache ? null : await readCache(key, now, req.schema);
  if (hit !== null) {
    logger.info('AI cache hit', { feature: req.feature, cached: true });
    return { data: hit, cached: true };
  }

  const day = await reserveOrThrow(req, now);
  const data = await generate(req, day);
  if (req.shouldCache ? req.shouldCache(data) : true) await storeResult(req, key, data, now);
  return { data, cached: false };
}
