import { describe, expect, it } from 'vitest';
import type { SalesforceFieldSummary, SalesforceObjectDescribe } from '@varkole/shared';
import { autoMapImportHeaders, buildImportRecords } from './import-utils';

const field = (
  input: Partial<SalesforceFieldSummary> & Pick<SalesforceFieldSummary, 'name' | 'label' | 'type'>,
): SalesforceFieldSummary => ({
  custom: false,
  nillable: true,
  filterable: true,
  sortable: true,
  createable: true,
  updateable: true,
  ...input,
});

const objectDescribe: SalesforceObjectDescribe = {
  name: 'Account',
  label: 'Account',
  fields: [
    field({ name: 'Id', label: 'Account ID', type: 'id', createable: false, updateable: false }),
    field({ name: 'Name', label: 'Account Name', type: 'string' }),
    field({ name: 'AnnualRevenue', label: 'Annual Revenue', type: 'currency' }),
    field({ name: 'Active__c', label: 'Active', type: 'boolean' }),
  ],
  childRelationships: [],
};

describe('import mapping', () => {
  it('maps CSV labels or API names and converts supported scalar values', () => {
    const mapping = autoMapImportHeaders(
      ['Account ID', 'Name', 'Annual Revenue', 'Active'],
      objectDescribe,
      'update',
    );
    expect(mapping).toEqual({
      'Account ID': 'Id',
      Name: 'Name',
      'Annual Revenue': 'AnnualRevenue',
      Active: 'Active__c',
    });
    expect(
      buildImportRecords(
        [
          {
            'Account ID': '001000000000001AAA',
            Name: 'Updated name',
            'Annual Revenue': '1200.50',
            Active: 'true',
          },
        ],
        mapping,
        objectDescribe,
        'update',
      ),
    ).toEqual([
      {
        Id: '001000000000001AAA',
        Name: 'Updated name',
        AnnualRevenue: 1200.5,
        Active__c: true,
      },
    ]);
  });

  it('requires Id for update/delete and rejects duplicate field mappings', () => {
    expect(() =>
      buildImportRecords([{ Name: 'Test' }], { Name: 'Name' }, objectDescribe, 'update'),
    ).toThrow('mapped to Id');
    expect(() =>
      buildImportRecords(
        [{ First: 'A', Second: 'B' }],
        { First: 'Name', Second: 'Name' },
        objectDescribe,
        'insert',
      ),
    ).toThrow('only once');
  });
});
