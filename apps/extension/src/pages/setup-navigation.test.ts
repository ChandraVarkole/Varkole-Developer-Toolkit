import { describe, expect, it } from 'vitest';
import { salesforceSetupUrl, SETUP_PATHS } from './setup-navigation';

describe('Salesforce Setup navigation', () => {
  const org = { instanceUrl: 'https://acme.my.salesforce.com' };

  it('keeps allowlisted Setup links on the selected org', () => {
    expect(salesforceSetupUrl(org, SETUP_PATHS.flows)).toBe(
      'https://acme.my.salesforce.com/lightning/setup/Flows/home',
    );
    expect(salesforceSetupUrl(org, SETUP_PATHS.namedCredentials)).toBe(
      'https://acme.my.salesforce.com/lightning/setup/NamedCredential/home',
    );
  });

  it('rejects arbitrary and cross-org navigation targets', () => {
    expect(salesforceSetupUrl(org, 'https://attacker.example/setup')).toBeUndefined();
    expect(salesforceSetupUrl(org, '/lightning/setup/Unknown/home')).toBeUndefined();
  });
});
