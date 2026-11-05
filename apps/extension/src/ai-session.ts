import type { AiSessionConfig } from './ai-provider';

export const AI_REMEMBER_DURATION_MS = 8 * 60 * 60 * 1_000;

export interface RememberedAiConfig {
  config: AiSessionConfig;
  expiresAt: string;
}

export function createRememberedAiConfig(
  config: AiSessionConfig,
  now = Date.now(),
): RememberedAiConfig {
  return {
    config,
    expiresAt: new Date(now + AI_REMEMBER_DURATION_MS).toISOString(),
  };
}

export function isRememberedAiConfigActive(
  value: RememberedAiConfig | undefined,
  now = Date.now(),
): value is RememberedAiConfig {
  if (!value?.config || typeof value.expiresAt !== 'string') return false;
  const expiresAt = Date.parse(value.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt > now;
}
