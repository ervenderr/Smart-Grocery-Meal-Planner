/**
 * Shared helpers for AI tests: fake provider responses, deps installation,
 * unique names (so a shared cache never produces cross-test hits) and a
 * user-with-pantry factory.
 */

import crypto from 'crypto';
import request from 'supertest';
import type { Application } from 'express';
import { OpenAiCompatibleProvider } from '../../src/modules/ai/providers/openai-compatible.provider';
import { setAiDepsForTests } from '../../src/modules/ai/ai.deps';

export const TEST_BASE_URL = 'https://llm.test/v1';
export const TEST_API_KEY = 'test-key';

/** Mirrors the live OpenAI-compatible chat.completion shape. */
export function chatCompletion(
  content: string,
  init: { status?: number; finishReason?: string } = {}
): Response {
  const body = {
    id: 'chatcmpl-test',
    object: 'chat.completion',
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content },
        finish_reason: init.finishReason ?? 'stop',
      },
    ],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  };
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function errorResponse(status: number, message = 'provider error'): Response {
  return new Response(JSON.stringify({ error: { message, type: 'error' } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function buildTestProvider(apiKey: string | undefined = TEST_API_KEY): OpenAiCompatibleProvider {
  return new OpenAiCompatibleProvider({
    label: 'test',
    baseUrl: TEST_BASE_URL,
    model: 'test-model',
    apiKey,
    timeoutMs: 2000,
    jsonMode: 'off',
  });
}

/** Installs a configured fake provider and very high limits. */
export function installFakeAi(_fetchSpy?: unknown): void {
  setAiDepsForTests({
    provider: buildTestProvider(),
    limits: { userDaily: 100000, globalDaily: 100000 },
  });
}

export function uniqueName(base: string): string {
  return `${base}-${crypto.randomBytes(4).toString('hex')}`;
}

export async function createUserWithPantry(
  app: Application,
  names: string[]
): Promise<{ token: string; userId: string; email: string }> {
  const email = `ai-${crypto.randomBytes(6).toString('hex')}@example.com`;
  const signup = await request(app)
    .post('/api/v1/auth/signup')
    .send({ email, password: 'TestPass123', firstName: 'Aiko', lastName: 'Tester' });
  const token: string = signup.body.token;
  const userId: string = signup.body.user.id;
  for (const ingredientName of names) {
    await request(app)
      .post('/api/v1/pantry')
      .set('Authorization', `Bearer ${token}`)
      .send({ ingredientName, quantity: 2, unit: 'pieces', category: 'other' });
  }
  return { token, userId, email };
}
