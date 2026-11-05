import { afterEach, describe, expect, it, vi } from 'vitest';
import { providerOrigin, requestAiResponse, type AiSessionConfig } from './ai-provider';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AI provider adapters', () => {
  it.each([
    [
      'openai',
      { output: [{ content: [{ type: 'output_text', text: 'OpenAI answer' }] }] },
      'OpenAI answer',
    ],
    ['anthropic', { content: [{ type: 'text', text: 'Claude answer' }] }, 'Claude answer'],
    [
      'gemini',
      { candidates: [{ content: { parts: [{ text: 'Gemini answer' }] } }] },
      'Gemini answer',
    ],
    [
      'bedrock',
      { output: { message: { content: [{ text: 'Bedrock answer' }] } } },
      'Bedrock answer',
    ],
  ] as const)('parses %s text responses', async (provider, responseBody, expected) => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const config: AiSessionConfig = {
      provider,
      apiKey: 'test-key',
      model: 'test-model',
      ...(provider === 'bedrock' ? { region: 'us-east-1' } : {}),
    };

    await expect(
      requestAiResponse(config, [{ role: 'user', content: 'Review this.' }], '{}'),
    ).resolves.toBe(expected);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('builds only allowlisted provider origins', () => {
    expect(providerOrigin({ provider: 'openai' })).toBe('https://api.openai.com/*');
    expect(providerOrigin({ provider: 'bedrock', region: 'us-west-2' })).toBe(
      'https://bedrock-runtime.us-west-2.amazonaws.com/*',
    );
    expect(() => providerOrigin({ provider: 'bedrock', region: 'example.com' })).toThrow(
      'valid AWS region',
    );
  });

  it('distinguishes exhausted API credits from a temporary rate limit', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { message: 'credit_balance_exhausted: Add credits to continue.' },
          }),
          { status: 429, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );

    await expect(
      requestAiResponse(
        { provider: 'openai', apiKey: 'test-key', model: 'gpt-6-luna' },
        [{ role: 'user', content: 'Test.' }],
        '{}',
      ),
    ).rejects.toThrow('API credits are exhausted');
  });
});
