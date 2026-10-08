import { OpenAiCompatibleProvider } from '../src/modules/ai/providers/openai-compatible.provider';
import { ProviderError } from '../src/modules/ai/providers/llm-provider';
import { logger } from '../src/config/logger.config';
import { chatCompletion, errorResponse } from './helpers/ai-test-helpers';

const make = (over: Partial<ConstructorParameters<typeof OpenAiCompatibleProvider>[0]> = {}) =>
  new OpenAiCompatibleProvider({
    label: 'test',
    baseUrl: 'https://llm.test/v1',
    model: 'm1',
    apiKey: 'SECRET-KEY-123',
    timeoutMs: 1000,
    jsonMode: 'off',
    ...over,
  });

const opts = { maxTokens: 100, temperature: 0.2 };
const msgs = [{ role: 'user' as const, content: 'hi' }];

let fetchSpy: jest.SpyInstance;
beforeEach(() => {
  fetchSpy = jest.spyOn(global, 'fetch');
});

const kindOf = async (p: Promise<unknown>): Promise<string> => {
  try {
    await p;
  } catch (e) {
    return e instanceof ProviderError ? e.kind : 'other';
  }
  return 'none';
};

describe('OpenAiCompatibleProvider request', () => {
  it('posts to /chat/completions with bearer auth and returns content', async () => {
    fetchSpy.mockResolvedValueOnce(chatCompletion('hello'));
    await expect(make().complete(msgs, opts)).resolves.toBe('hello');
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://llm.test/v1/chat/completions');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.headers.Authorization).toBe('Bearer SECRET-KEY-123');
    expect(JSON.parse(init.body)).toEqual({
      model: 'm1', messages: msgs, temperature: 0.2, max_tokens: 100,
    });
  });

  it('adds response_format only in json_object mode', async () => {
    fetchSpy.mockResolvedValueOnce(chatCompletion('{}'));
    await make({ jsonMode: 'json_object' }).complete(msgs, opts);
    expect(JSON.parse(fetchSpy.mock.calls[0][1].body).response_format).toEqual({ type: 'json_object' });
  });
});

describe('OpenAiCompatibleProvider error mapping', () => {
  const statuses: Array<[number, string]> = [
    [401, 'auth'], [403, 'auth'], [402, 'exhausted'], [429, 'rate_limited'],
    [400, 'bad_response'], [500, 'unavailable'], [503, 'unavailable'],
  ];
  it.each(statuses)('maps HTTP %i to %s', async (status, kind) => {
    fetchSpy.mockResolvedValueOnce(errorResponse(status));
    expect(await kindOf(make().complete(msgs, opts))).toBe(kind);
  });

  it('maps fetch TypeError to unavailable', async () => {
    fetchSpy.mockRejectedValueOnce(new TypeError('fetch failed'));
    expect(await kindOf(make().complete(msgs, opts))).toBe('unavailable');
  });

  it('maps Timeout/Abort errors to timeout', async () => {
    fetchSpy.mockRejectedValueOnce(new DOMException('t', 'TimeoutError'));
    expect(await kindOf(make().complete(msgs, opts))).toBe('timeout');
    fetchSpy.mockRejectedValueOnce(new DOMException('a', 'AbortError'));
    expect(await kindOf(make().complete(msgs, opts))).toBe('timeout');
  });

  it('maps empty content and finish_reason length to bad_response', async () => {
    fetchSpy.mockResolvedValueOnce(chatCompletion('   '));
    expect(await kindOf(make().complete(msgs, opts))).toBe('bad_response');
    fetchSpy.mockResolvedValueOnce(chatCompletion('partial', { finishReason: 'length' }));
    expect(await kindOf(make().complete(msgs, opts))).toBe('bad_response');
  });

  it('is not configured without a key and never calls fetch', async () => {
    const p = make({ apiKey: undefined });
    expect(p.isConfigured()).toBe(false);
    expect(await kindOf(p.complete(msgs, opts))).toBe('not_configured');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('OpenAiCompatibleProvider logging', () => {
  it('never logs the api key or authorization header', async () => {
    const spies = (['warn', 'error', 'info', 'debug'] as const).map((l) => jest.spyOn(logger, l));
    fetchSpy
      .mockResolvedValueOnce(errorResponse(400, 'model not offered'))
      .mockResolvedValueOnce(errorResponse(402))
      .mockResolvedValueOnce(errorResponse(500));
    for (let i = 0; i < 3; i++) await kindOf(make().complete(msgs, opts));
    const logged = JSON.stringify(spies.flatMap((s) => s.mock.calls));
    expect(logged).not.toContain('SECRET-KEY-123');
    expect(logged.toLowerCase()).not.toContain('bearer');
    expect(logged).toContain('model not offered');
  });
});
