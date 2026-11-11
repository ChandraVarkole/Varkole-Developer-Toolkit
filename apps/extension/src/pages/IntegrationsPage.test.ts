import { describe, expect, it } from 'vitest';
import { INTEGRATION_QUERIES } from './integration-config';

describe('integration inventory queries', () => {
  it('uses compatible Named Credential fields and the requested query order', () => {
    expect(INTEGRATION_QUERIES.map((config) => config.id)).toEqual([
      'connected-apps',
      'named-credentials',
      'external-credentials',
    ]);
    const namedCredentialQuery = INTEGRATION_QUERIES.find(
      (config) => config.id === 'named-credentials',
    )?.query;
    expect(namedCredentialQuery).toContain('NamedCredentialType');
    expect(namedCredentialQuery).toContain('CalloutStatus');
    expect(namedCredentialQuery).not.toContain('CalloutOptionsGenerateAuthorizationHeader');
  });
});
