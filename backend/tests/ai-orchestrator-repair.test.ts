/**
 * Repair call hygiene and overall deadline (WR-07).
 */

import { prisma } from '../src/config/database.config';
import { z } from 'zod';
import { resetAiDepsForTests, setAiDepsForTests } from '../src/modules/ai/ai.deps';
import { runAiFeature } from '../src/modules/ai/ai.orchestrator';
import type { LlmMessage, LlmProvider } from '../src/modules/ai/providers/llm-provider';
import { uniqueName } from './helpers/ai-test-helpers';

const schema = z.object({ ok: z.literal(true) });

function fakeProvider(replies: string[]) {
  const calls: Array<{ messages: readonly LlmMessage[]; timeoutMs?: number }> = [];
  const provider: LlmProvider = {
    label: 'fake',
    isConfigured: () => true,
    complete: async (messages, opts) => {
      calls.push({ messages, timeoutMs: opts.timeoutMs });
      return replies[calls.length - 1] ?? 'nothing';
    },
  };
  return { provider, calls };
}

const run = () =>
  runAiFeature({
    feature: 'substitutions',
    schemaVersion: 1,
    userId: uniqueName('repair-user'),
    cacheInputs: { n: uniqueName('k') },
    messages: [{ role: 'user', content: 'go' }],
    schema,
    maxTokens: 100,
    temperature: 0,
  });

beforeEach(() => {
  setAiDepsForTests({ limits: { userDaily: 1000, globalDaily: 100000 }, now: () => new Date('2032-02-01T12:00:00Z') });
});

afterEach(async () => {
  resetAiDepsForTests();
  await prisma.$executeRaw`DELETE FROM ai_usage WHERE day = '2032-02-01'::date`;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('repair call', () => {
  it('does not echo <think> blocks and echoes the tail of the answer', async () => {
    const think = `<think>${'secret reasoning '.repeat(500)}</think>`;
    const { provider, calls } = fakeProvider([`${think}{"ok": false}`, '{"ok": true}']);
    setAiDepsForTests({ provider });

    const { data } = await run();

    expect(data).toEqual({ ok: true });
    const assistant = calls[1].messages.find((m) => m.role === 'assistant');
    expect(assistant?.content).toBe('{"ok": false}');
    expect(JSON.stringify(calls[1].messages)).not.toContain('secret reasoning');
  });

  it('caps both calls to the total budget (second gets only the remainder)', async () => {
    const { provider, calls } = fakeProvider(['not json', '{"ok": true}']);
    setAiDepsForTests({ provider, totalTimeoutMs: 20000 });

    await run();

    expect(calls[0].timeoutMs).toBe(20000);
    expect(calls[1].timeoutMs).toBeLessThanOrEqual(20000);
    expect(calls[1].timeoutMs).toBeGreaterThan(0);
  });

  it('skips the repair call when too little of the budget remains', async () => {
    const { provider, calls } = fakeProvider(['not json', '{"ok": true}']);
    setAiDepsForTests({ provider, totalTimeoutMs: 1500 });

    await expect(run()).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' });
    expect(calls).toHaveLength(1);
  });
});
