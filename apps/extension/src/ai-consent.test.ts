import { describe, expect, it } from 'vitest';
import { AI_DISCLOSURE_VERSION, createAiDataConsent, isAiDataConsentActive } from './ai-consent';

describe('AI data consent', () => {
  it('records affirmative consent for the selected provider and disclosure version', () => {
    const grantedAt = new Date('2026-11-05T12:00:00.000Z');
    const consent = createAiDataConsent('openai', grantedAt);

    expect(consent).toEqual({
      provider: 'openai',
      disclosureVersion: AI_DISCLOSURE_VERSION,
      grantedAt: grantedAt.toISOString(),
    });
    expect(isAiDataConsentActive(consent, 'openai')).toBe(true);
  });

  it('rejects consent for another provider, an old disclosure, or an invalid timestamp', () => {
    const consent = createAiDataConsent('openai');

    expect(isAiDataConsentActive(consent, 'anthropic')).toBe(false);
    expect(
      isAiDataConsentActive({ ...consent, disclosureVersion: AI_DISCLOSURE_VERSION - 1 }, 'openai'),
    ).toBe(false);
    expect(isAiDataConsentActive({ ...consent, grantedAt: 'invalid' }, 'openai')).toBe(false);
  });
});
