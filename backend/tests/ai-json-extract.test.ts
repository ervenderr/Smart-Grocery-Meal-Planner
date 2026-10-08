import { extractJson, JsonExtractError, stripReasoning } from '../src/modules/ai/json-extract';

describe('stripReasoning', () => {
  it('removes closed think blocks case-insensitively', () => {
    expect(stripReasoning('<THINK>a\nb</THINK>\n\nanswer').trim()).toBe('answer');
  });

  it('drops everything after an unterminated think block', () => {
    expect(stripReasoning('before <think>never closed').trim()).toBe('before');
  });

  it('keeps only the text after the last stray closing tag', () => {
    expect(stripReasoning('reasoning here</think>\n\nfinal').trim()).toBe('final');
  });
});

describe('extractJson', () => {
  it('handles the live MiniMax shape with braces inside the think block', () => {
    const text = '<think>reasoning with { braces } and [brackets]</think>\n\n{"recipes":[]}';
    expect(extractJson(text)).toEqual({ recipes: [] });
  });

  it('throws on an unterminated think block', () => {
    expect(() => extractJson('<think>never closed {"a":1}')).toThrow(JsonExtractError);
  });

  it('uses only the text after a lone closing think tag', () => {
    expect(extractJson('{"x":1} reasoning</think>\n{"y":2}')).toEqual({ y: 2 });
  });

  it('strips code fences', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('ignores leading and trailing prose', () => {
    expect(extractJson('Here you go: {"a":[1,2]} hope it helps')).toEqual({ a: [1, 2] });
  });

  it('handles braces and escaped quotes inside strings', () => {
    expect(extractJson('x {"a":"} \\" {"} y')).toEqual({ a: '} " {' });
  });

  it('returns the first balanced value', () => {
    expect(extractJson('[1,2] {"a":1}')).toEqual([1, 2]);
  });

  it('skips a stray bracket in prose and finds the real object', () => {
    expect(extractJson('Here are 3 [great] recipes: {"recipes":[]}')).toEqual({ recipes: [] });
  });

  it('skips an unbalanced leading brace', () => {
    expect(extractJson('use { carefully: {"a":1}')).toEqual({ a: 1 });
  });

  it('prefers an object over an earlier array when asked', () => {
    expect(extractJson('[1,2] {"a":1}', { prefer: 'object' })).toEqual({ a: 1 });
    expect(extractJson('[1,2]', { prefer: 'object' })).toEqual([1, 2]);
  });

  it('keeps triple backticks that are inside JSON strings', () => {
    const text = '```json\n{"code":"use ```js\\nx``` here"}\n```';
    expect(extractJson(text)).toEqual({ code: 'use ```js\nx``` here' });
  });

  it('throws when no JSON is present or it is unbalanced', () => {
    expect(() => extractJson('just prose')).toThrow(JsonExtractError);
    expect(() => extractJson('{"a":')).toThrow(JsonExtractError);
    expect(() => extractJson('{a:1}')).toThrow(JsonExtractError);
  });
});
