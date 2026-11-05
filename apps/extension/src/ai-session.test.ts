import { describe, expect, it } from 'vitest';
import {
  AI_REMEMBER_DURATION_MS,
  createRememberedAiConfig,
  isRememberedAiConfigActive,
} from './ai-session';

const config = {
  provider: 'openai' as const,
  apiKey: 'test-key',
  model: 'test-model',
};

describe('remembered AI configuration', () => {
  it('expires exactly eight hours after it is created', () => {
    const now = Date.parse('2026-11-05T12:00:00.000Z');
    const remembered = createRememberedAiConfig(config, now);

    expect(remembered.expiresAt).toBe('2026-11-05T20:00:00.000Z');
    expect(isRememberedAiConfigActive(remembered, now + AI_REMEMBER_DURATION_MS - 1)).toBe(true);
    expect(isRememberedAiConfigActive(remembered, now + AI_REMEMBER_DURATION_MS)).toBe(false);
  });

  it('rejects missing and invalid expiration data', () => {
    expect(isRememberedAiConfigActive(undefined)).toBe(false);
    expect(isRememberedAiConfigActive({ config, expiresAt: 'invalid' })).toBe(false);
  });
});
