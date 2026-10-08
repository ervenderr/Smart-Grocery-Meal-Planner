/**
 * Provider-agnostic LLM contract. A native adapter (e.g. Gemini) can be added
 * later by implementing LlmProvider.
 */

export interface LlmMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

export interface LlmCompleteOptions {
  readonly maxTokens: number;
  readonly temperature: number;
  /** Optional per-call cap; the effective timeout is min(configured, this). */
  readonly timeoutMs?: number;
}

export interface LlmProvider {
  readonly label: string;
  isConfigured(): boolean;
  complete(messages: readonly LlmMessage[], opts: LlmCompleteOptions): Promise<string>;
}

export type ProviderErrorKind =
  | 'not_configured'
  | 'auth'
  | 'exhausted'
  | 'rate_limited'
  | 'unavailable'
  | 'timeout'
  | 'bad_response';

export class ProviderError extends Error {
  constructor(
    public readonly kind: ProviderErrorKind,
    public readonly status?: number
  ) {
    super(`LLM provider error: ${kind}${status ? ` (${status})` : ''}`);
    Object.setPrototypeOf(this, ProviderError.prototype);
  }
}
