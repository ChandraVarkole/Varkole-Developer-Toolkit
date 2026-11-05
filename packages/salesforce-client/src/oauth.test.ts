import { describe, expect, it } from 'vitest';
import { normalizeSalesforceLoginUrl, validateOAuthCallback } from './oauth';

describe('Salesforce OAuth validation', () => {
  it('normalizes known Salesforce hosts', () => {
    expect(normalizeSalesforceLoginUrl('acme--dev.sandbox.my.salesforce.com')).toBe(
      'https://acme--dev.sandbox.my.salesforce.com',
    );
  });

  it.each([
    'http://login.salesforce.com',
    'https://salesforce.com.evil.example',
    'https://user@login.salesforce.com',
    'https://127.0.0.1',
    'https://login.salesforce.com/path',
  ])('rejects unsafe host %s', (host) => {
    expect(() => normalizeSalesforceLoginUrl(host)).toThrow('valid HTTPS Salesforce domain');
  });

  it('accepts a matching callback and code', () => {
    expect(
      validateOAuthCallback(
        'https://abc.chromiumapp.org/salesforce?code=ok&state=expected',
        'https://abc.chromiumapp.org/salesforce',
        'expected',
      ),
    ).toEqual({ code: 'ok' });
  });

  it('rejects mismatched state', () => {
    expect(() =>
      validateOAuthCallback(
        'https://abc.chromiumapp.org/salesforce?code=ok&state=wrong',
        'https://abc.chromiumapp.org/salesforce',
        'expected',
      ),
    ).toThrow('state did not match');
  });
});
