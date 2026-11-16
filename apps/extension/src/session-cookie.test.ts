import { describe, expect, it } from 'vitest';
import {
  cookieMatchesOrg,
  normalizeSalesforceApiHost,
  salesforcePageMatchesInstance,
  selectApiSessionCookie,
} from './session-cookie';

describe('browser session selection', () => {
  const orgId = '00D123456789ABC';

  it('selects the API-capable My Domain cookie for the active org', () => {
    const selected = selectApiSessionCookie(
      [
        { domain: 'acme.lightning.force.com', value: `${orgId}!lightning` },
        { domain: 'acme.my.salesforce.com', value: `${orgId}!api` },
        { domain: 'other.my.salesforce.com', value: '00D999999999999!other' },
      ],
      orgId,
    );
    expect(selected).toEqual({
      domain: 'acme.my.salesforce.com',
      value: `${orgId}!api`,
    });
  });

  it('never selects a cookie for a different org', () => {
    expect(
      selectApiSessionCookie(
        [{ domain: 'other.my.salesforce.com', value: '00D999999999999!other' }],
        orgId,
      ),
    ).toBeUndefined();
  });

  it('matches a 15-character cookie org ID to its 18-character org identity', () => {
    const eighteenCharacterOrgId = '00Df40000025CgIEAE';
    const selected = selectApiSessionCookie(
      [
        {
          domain: 'bluesigma.my.salesforce.com',
          value: '00Df40000025CgI!browser-session',
        },
      ],
      eighteenCharacterOrgId,
    );

    expect(selected?.domain).toBe('bluesigma.my.salesforce.com');
  });

  it('does not match different 15-character org IDs', () => {
    expect(
      cookieMatchesOrg(
        {
          domain: 'other.my.salesforce.com',
          value: '00Df40000025ZZZ!other-session',
        },
        '00Df40000025CgIEAE',
      ),
    ).toBe(false);
  });

  it('does not fall back to a Lightning UI session', () => {
    expect(
      selectApiSessionCookie([], orgId, {
        domain: 'acme.lightning.force.com',
        value: `${orgId}!lightning-only`,
      }),
    ).toBeUndefined();
  });

  it('normalizes Lightning and Setup hosts to the API-capable My Domain host', () => {
    expect(normalizeSalesforceApiHost('acme.lightning.force.com')).toBe('acme.my.salesforce.com');
    expect(normalizeSalesforceApiHost('acme.my.salesforce-setup.com')).toBe(
      'acme.my.salesforce.com',
    );
    expect(normalizeSalesforceApiHost('acme--dev.sandbox.lightning.force.com')).toBe(
      'acme--dev.sandbox.my.salesforce.com',
    );
  });

  it('matches the Lightning and Setup variants of the selected org only', () => {
    expect(
      salesforcePageMatchesInstance(
        'https://acme.lightning.force.com/lightning/page/home',
        'https://acme.my.salesforce.com',
      ),
    ).toBe(true);
    expect(
      salesforcePageMatchesInstance(
        'https://acme.my.salesforce-setup.com/lightning/setup/DebugMode/home',
        'https://acme.my.salesforce.com',
      ),
    ).toBe(true);
    expect(
      salesforcePageMatchesInstance(
        'https://other.lightning.force.com/lightning/page/home',
        'https://acme.my.salesforce.com',
      ),
    ).toBe(false);
  });
});
