/**
 * Injectable AI dependencies. Default deps are built lazily from config so a
 * missing AI_API_KEY never breaks startup. Test setters always replace the
 * module-level reference with a NEW object (no mutation).
 */

import { config } from '../../config/env.config';
import { AiLimitConfig } from './ai-limits';
import { LlmProvider } from './providers/llm-provider';
import { OpenAiCompatibleProvider } from './providers/openai-compatible.provider';

export interface AiDeps {
  readonly provider: LlmProvider;
  readonly limits: AiLimitConfig;
  readonly now: () => Date;
  /** Overall budget for one feature run (initial call plus repair). */
  readonly totalTimeoutMs: number;
}

let current: AiDeps | undefined;

function buildDefaultDeps(): AiDeps {
  return {
    provider: new OpenAiCompatibleProvider({
      label: config.ai.provider,
      baseUrl: config.ai.baseUrl,
      model: config.ai.model,
      apiKey: config.ai.apiKey,
      timeoutMs: config.ai.timeoutMs,
      jsonMode: config.ai.jsonMode,
    }),
    limits: {
      userDaily: config.ai.userDailyLimit,
      globalDaily: config.ai.globalDailyLimit,
      paidUserDaily: config.ai.paidUserDailyLimit,
      freeMonthly: config.ai.freeMonthlyLimit,
      paidMonthly: config.ai.paidMonthlyLimit,
    },
    now: () => new Date(),
    totalTimeoutMs: config.ai.timeoutMs,
  };
}

export function getAiDeps(): AiDeps {
  if (!current) current = buildDefaultDeps();
  return current;
}

export function setAiDepsForTests(partial: Partial<AiDeps>): void {
  current = { ...getAiDeps(), ...partial };
}

export function resetAiDepsForTests(): void {
  current = undefined;
}
