import { describe, expect, it } from 'vitest';
import { recordIdFromQueryRecord, recordUrlForCell, salesforceRecordUrl } from './record-links';

describe('Salesforce record links', () => {
  it('extracts a record ID from Id or the REST attributes URL', () => {
    expect(recordIdFromQueryRecord({ Id: '001000000000001AAA' })).toBe('001000000000001AAA');
    expect(
      recordIdFromQueryRecord({
        attributes: { url: '/services/data/v68.0/sobjects/Account/001000000000002AAA' },
      }),
    ).toBe('001000000000002AAA');
  });

  it('links record and lookup ID fields to the selected org origin', () => {
    expect(
      recordUrlForCell('https://example.my.salesforce.com', 'OwnerId', '005000000000001AAA'),
    ).toBe('https://example.my.salesforce.com/005000000000001AAA');
    expect(
      recordUrlForCell('https://example.my.salesforce.com', 'Account.Id', '001000000000001AAA'),
    ).toBe('https://example.my.salesforce.com/001000000000001AAA');
  });

  it('rejects non-ID values and invalid base URLs', () => {
    expect(
      recordUrlForCell('https://example.my.salesforce.com', 'Name', '001000000000001AAA'),
    ).toBeUndefined();
    expect(salesforceRecordUrl('not a URL', '001000000000001AAA')).toBeUndefined();
  });
});
