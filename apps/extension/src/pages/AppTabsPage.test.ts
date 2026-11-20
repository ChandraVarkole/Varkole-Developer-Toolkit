import { describe, expect, it } from 'vitest';
import type { OrgIdentity } from '@varkole/shared';
import { salesforceTabUrl } from './app-tab-url';

const org: OrgIdentity = {
  key: 'org',
  orgId: '00D000000000001AAA',
  userId: '005000000000001AAA',
  username: 'dev@example.com',
  displayName: 'Developer',
  organizationName: 'Acme',
  instanceUrl: 'https://acme.my.salesforce.com',
  loginUrl: 'https://login.salesforce.com',
  environment: 'production',
  alias: 'Acme',
  apiVersion: '68.0',
  connectedAt: '2026-01-01T00:00:00.000Z',
  lastUsedAt: '2026-01-01T00:00:00.000Z',
  connected: true,
  connectionSource: 'browser-session',
};

describe('Salesforce tab navigation links', () => {
  it('resolves Salesforce tab paths on the selected org', () => {
    expect(
      salesforceTabUrl(org, {
        label: 'Accounts',
        sobjectName: 'Account',
        custom: false,
      }),
    ).toBe('https://acme.my.salesforce.com/lightning/o/Account/list');
    expect(
      salesforceTabUrl(org, {
        label: 'Custom',
        url: '/lightning/n/Custom_Tab',
        custom: true,
      }),
    ).toBe('https://acme.my.salesforce.com/lightning/n/Custom_Tab');
  });

  it('rejects tab URLs that leave the selected Salesforce org', () => {
    expect(
      salesforceTabUrl(org, {
        label: 'Unsafe',
        url: 'https://attacker.example/collect',
        custom: true,
      }),
    ).toBeUndefined();
  });

  it('opens custom tabs by API name and accepts Salesforce-hosted tab URLs', () => {
    expect(salesforceTabUrl(org, { label: 'Custom page', name: 'Custom_Page', custom: true })).toBe(
      'https://acme.my.salesforce.com/lightning/n/Custom_Page',
    );
    expect(
      salesforceTabUrl(org, {
        label: 'Visualforce tab',
        url: 'https://acme--c.visualforce.com/apex/CustomPage',
        custom: true,
      }),
    ).toBe('https://acme--c.visualforce.com/apex/CustomPage');
  });
});
