import { describe, expect, it } from 'vitest';
import { salesforceSetupUrl, SETUP_PATHS } from './setup-navigation';

describe('Salesforce Setup navigation', () => {
  const org = { instanceUrl: 'https://acme.my.salesforce.com' };

  it('keeps allowlisted Setup links on the selected org', () => {
    expect(salesforceSetupUrl(org, SETUP_PATHS.flows)).toBe(
      'https://acme.my.salesforce-setup.com/lightning/setup/Flows/home',
    );
    expect(salesforceSetupUrl(org, SETUP_PATHS.namedCredentials)).toBe(
      'https://acme.my.salesforce-setup.com/lightning/setup/NamedCredential/home',
    );
    expect(salesforceSetupUrl(org, SETUP_PATHS.debugMode)).toBe(
      'https://acme.my.salesforce-setup.com/lightning/setup/UserDebugModeSetup/home',
    );
    expect(salesforceSetupUrl(org, SETUP_PATHS.sessionSettings)).toBe(
      'https://acme.my.salesforce-setup.com/lightning/setup/SecuritySession/home',
    );
    expect(salesforceSetupUrl(org, SETUP_PATHS.apexTestExecution)).toBe(
      'https://acme.my.salesforce-setup.com/lightning/setup/ApexTestQueue/home',
    );
    expect(salesforceSetupUrl(org, SETUP_PATHS.debugLogs)).toBe(
      'https://acme.my.salesforce-setup.com/lightning/setup/ApexDebugLogs/home',
    );
  });

  it('rejects arbitrary and cross-org navigation targets', () => {
    expect(salesforceSetupUrl(org, 'https://attacker.example/setup')).toBeUndefined();
    expect(salesforceSetupUrl(org, '/lightning/setup/Unknown/home')).toBeUndefined();
  });
});
