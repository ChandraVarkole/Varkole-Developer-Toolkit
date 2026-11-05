import { describe, expect, it } from 'vitest';
import { recordIdFromSalesforceUrl } from './record-context';

describe('recordIdFromSalesforceUrl', () => {
  it('extracts Lightning record IDs with and without an object name', () => {
    expect(
      recordIdFromSalesforceUrl(
        'https://example.my.salesforce.com/lightning/r/Account/0011G00000ABCdeQAH/view',
      ),
    ).toBe('0011G00000ABCdeQAH');
    expect(
      recordIdFromSalesforceUrl(
        'https://example.my.salesforce.com/lightning/r/0011G00000ABCdeQAH/view',
      ),
    ).toBe('0011G00000ABCdeQAH');
  });

  it('returns no context for setup pages', () => {
    expect(
      recordIdFromSalesforceUrl(
        'https://example.my.salesforce-setup.com/lightning/setup/ObjectManager/home',
      ),
    ).toBeUndefined();
  });
});
