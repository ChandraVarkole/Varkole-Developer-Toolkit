import type { AiProvider } from '@varkole/shared';

export const AI_DISCLOSURE_VERSION = 1;

export interface AiDataConsent {
  provider: AiProvider;
  disclosureVersion: number;
  grantedAt: string;
}

export function createAiDataConsent(provider: AiProvider, now = new Date()): AiDataConsent {
  return {
    provider,
    disclosureVersion: AI_DISCLOSURE_VERSION,
    grantedAt: now.toISOString(),
  };
}

export function isAiDataConsentActive(
  value: AiDataConsent | undefined,
  provider: AiProvider,
): value is AiDataConsent {
  return (
    value?.provider === provider &&
    value.disclosureVersion === AI_DISCLOSURE_VERSION &&
    Number.isFinite(Date.parse(value.grantedAt))
  );
}
