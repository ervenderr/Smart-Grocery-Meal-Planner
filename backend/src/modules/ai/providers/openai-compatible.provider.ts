/**
 * OpenAI-compatible chat completions adapter (native fetch).
 *
 * Never logs the API key, headers, prompts or request bodies.
 */

import { logger } from '../../../config/logger.config';
import {
  LlmCompleteOptions,
  LlmMessage,
  LlmProvider,
  ProviderError,
} from './llm-provider';

export interface OpenAiCompatibleConfig {
  readonly label: string;
  readonly baseUrl: string;
  readonly model: string;
  readonly apiKey?: string;
  readonly timeoutMs: number;
  readonly jsonMode: 'off' | 'json_object';
}

interface ChatCompletionBody {
  readonly choices?: ReadonlyArray<{
    readonly message?: { readonly content?: unknown };
    readonly finish_reason?: unknown;
  }>;
  readonly error?: { readonly message?: unknown };
}

export class OpenAiCompatibleProvider implements LlmProvider {
  readonly label: string;

  constructor(private readonly cfg: OpenAiCompatibleConfig) {
    this.label = cfg.label;
  }

  isConfigured(): boolean {
    return typeof this.cfg.apiKey === 'string' && this.cfg.apiKey.length > 0;
  }

  async complete(messages: readonly LlmMessage[], opts: LlmCompleteOptions): Promise<string> {
    if (!this.isConfigured()) throw new ProviderError('not_configured');
    const res = await this.send(messages, opts);
    if (!res.ok) await this.failFromStatus(res);
    return this.extractContent(await this.readBody(res));
  }

  private async send(messages: readonly LlmMessage[], opts: LlmCompleteOptions): Promise<Response> {
    const body = {
      model: this.cfg.model,
      messages,
      temperature: opts.temperature,
      max_tokens: opts.maxTokens,
      ...(this.cfg.jsonMode === 'json_object' ? { response_format: { type: 'json_object' } } : {}),
    };
    try {
      return await fetch(`${this.cfg.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.cfg.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(Math.min(this.cfg.timeoutMs, opts.timeoutMs ?? this.cfg.timeoutMs)),
      });
    } catch (error) {
      const name = (error as { name?: string } | null)?.name;
      if (name === 'TimeoutError' || name === 'AbortError') throw new ProviderError('timeout');
      throw new ProviderError('unavailable');
    }
  }

  private async failFromStatus(res: Response): Promise<never> {
    const { status } = res;
    if (status === 401 || status === 403) throw new ProviderError('auth', status);
    if (status === 402) {
      logger.warn('AI provider tokens exhausted or not allocated to key', { status });
      throw new ProviderError('exhausted', status);
    }
    if (status === 429) throw new ProviderError('rate_limited', status);
    if (status === 400) {
      const parsed = await this.readBody(res).catch(() => undefined);
      const detail = parsed?.error?.message;
      logger.warn('AI provider rejected request (check AI_MODEL)', {
        status,
        providerMessage: typeof detail === 'string' ? detail.slice(0, 500) : undefined,
      });
      throw new ProviderError('bad_response', status);
    }
    throw new ProviderError('unavailable', status);
  }

  private async readBody(res: Response): Promise<ChatCompletionBody> {
    try {
      return (await res.json()) as ChatCompletionBody;
    } catch (error) {
      const name = (error as { name?: string } | null)?.name;
      if (name === 'TimeoutError' || name === 'AbortError') throw new ProviderError('timeout');
      throw new ProviderError('bad_response', res.status);
    }
  }

  private extractContent(body: ChatCompletionBody): string {
    const choice = body.choices?.[0];
    const content = choice?.message?.content;
    if (typeof content !== 'string' || content.trim() === '') {
      throw new ProviderError('bad_response');
    }
    if (choice?.finish_reason === 'length') throw new ProviderError('bad_response');
    return content;
  }
}
