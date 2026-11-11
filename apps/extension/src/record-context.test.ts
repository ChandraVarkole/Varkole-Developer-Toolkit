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

  it('extracts direct Salesforce Classic record URLs', () => {
    expect(recordIdFromSalesforceUrl('https://example.my.salesforce.com/0011G00000ABCde')).toBe(
      '0011G00000ABCde',
    );
    expect(
      recordIdFromSalesforceUrl('https://example.my.salesforce.com/5001G00000ABCdeQAH?isdtp=vw'),
    ).toBe('5001G00000ABCdeQAH');
  });

  it('extracts records from encoded Classic Console routes and direct record parameters', () => {
    expect(
      recordIdFromSalesforceUrl(
        'https://example.my.salesforce.com/console#%2F5001G00000ABCdeQAH%3Fisdtp%3Dvw',
      ),
    ).toBe('5001G00000ABCdeQAH');
    expect(
      recordIdFromSalesforceUrl(
        'https://example.my.salesforce.com/apex/RecordViewer?id=0011G00000ABCdeQAH',
      ),
    ).toBe('0011G00000ABCdeQAH');
  });

  it('returns no context for setup pages', () => {
    expect(
      recordIdFromSalesforceUrl(
        'https://example.my.salesforce-setup.com/lightning/setup/ObjectManager/home',
      ),
    ).toBeUndefined();
    expect(
      recordIdFromSalesforceUrl(
        'https://example.my.salesforce.com/frontdoor.jsp?id=00D1G000000ABCdUAG',
      ),
    ).toBeUndefined();
  });
});
