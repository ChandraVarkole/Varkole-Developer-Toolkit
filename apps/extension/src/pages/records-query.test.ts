import { describe, expect, it } from 'vitest';
import { buildRecordsQuery, inferObjectFromRecordId } from './records-query';

describe('buildRecordsQuery', () => {
  it('builds a bounded object query', () => {
    expect(
      buildRecordsQuery({ objectApiName: 'Account', fields: 'Id, Name, Owner.Name', limit: 50 }),
    ).toBe('SELECT Id, Name, Owner.Name\nFROM Account\nLIMIT 50');
  });

  it('builds a single-record query for an 18-character ID', () => {
    expect(
      buildRecordsQuery({
        objectApiName: 'Invoice__c',
        fields: 'Id, Name',
        recordId: 'a001G00000ABCdeQAH',
      }),
    ).toContain("WHERE Id = 'a001G00000ABCdeQAH'\nLIMIT 1");
  });

  it('uses FIELDS(ALL) only for a bounded record inspection', () => {
    expect(
      buildRecordsQuery({
        objectApiName: 'Account',
        fields: '',
        recordId: '0011G00000ABCdeQAH',
        inspectAllFields: true,
      }),
    ).toBe("SELECT FIELDS(ALL)\nFROM Account\nWHERE Id = '0011G00000ABCdeQAH'\nLIMIT 1");
  });

  it('infers an object from the Salesforce record key prefix', () => {
    const account = {
      name: 'Account',
      label: 'Account',
      keyPrefix: '001',
      custom: false,
      queryable: true,
      searchable: true,
    };
    expect(inferObjectFromRecordId('0011G00000ABCdeQAH', [account])?.name).toBe('Account');
    expect(inferObjectFromRecordId('not-an-id', [account])).toBeUndefined();
  });

  it('rejects untrusted object and field syntax', () => {
    expect(() =>
      buildRecordsQuery({ objectApiName: 'Account WHERE Name != null', fields: 'Id' }),
    ).toThrow('valid Salesforce object');
    expect(() => buildRecordsQuery({ objectApiName: 'Account', fields: 'Id, (SELECT Id' })).toThrow(
      'field API names',
    );
  });
});
