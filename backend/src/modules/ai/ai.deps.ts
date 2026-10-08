/**
 * Injectable AI dependencies. Default deps are built lazily from config so a
 * missing AI_API_KEY never breaks startup. Test setters always replace the
 * module-level reference with a NEW object (no mutation).
 */

import { config } from '../../config/env.config';
import { LlmProvider } from './providers/llm-provider';
import { OpenAiCompatibleProvider } from './providers/openai-compatible.provider';

export interface AiDeps {
  readonly provider: LlmProvider;
  readonly limits: { readonly userDaily: number; readonly globalDaily: number };
  readonly now: () => Date;
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
    limits: { userDaily: config.ai.userDailyLimit, globalDaily: config.ai.globalDailyLimit },
    now: () => new Date(),
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
