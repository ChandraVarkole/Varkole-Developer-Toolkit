import { describe, expect, it } from 'vitest';
import type { SalesforceObjectSummary } from '@varkole/shared';
import {
  matchingObjectSuggestions,
  objectDisplayLabel,
  objectSearchInputState,
  objectSelectionLabel,
  sortSalesforceObjects,
  sortSalesforceObjectsDescending,
} from './object-suggestions';

const objects: SalesforceObjectSummary[] = [
  { name: 'Zulu__c', label: 'Zulu', custom: true, queryable: true, searchable: true },
  { name: 'Account', label: 'Accounts', custom: false, queryable: true, searchable: true },
  {
    name: 'Alpha_Missing__c',
    label: 'Missing Label',
    custom: true,
    queryable: true,
    searchable: true,
  },
];

describe('Salesforce object suggestions', () => {
  it('sorts alphabetically and replaces unusable labels with the API name', () => {
    expect(sortSalesforceObjects(objects).map(objectDisplayLabel)).toEqual([
      'Accounts',
      'Alpha_Missing__c',
      'Zulu',
    ]);
  });

  it('sorts schema objects Z to A while keeping special-character labels last', () => {
    const input = [
      ...objects,
      { name: '_Internal__c', label: '_Internal', custom: true, queryable: true, searchable: true },
    ];
    expect(sortSalesforceObjectsDescending(input).map(objectDisplayLabel)).toEqual([
      'Zulu',
      'Alpha_Missing__c',
      'Accounts',
      '_Internal',
    ]);
  });

  it('waits for two characters and returns only matching objects', () => {
    expect(matchingObjectSuggestions(objects, 'a')).toEqual([]);
    expect(matchingObjectSuggestions(objects, 'al').map((object) => object.name)).toEqual([
      'Alpha_Missing__c',
    ]);
  });

  it('keeps duplicate labels distinct by including their API names', () => {
    const addresses: SalesforceObjectSummary[] = [
      { name: 'Address', label: 'Address', custom: false, queryable: true, searchable: true },
      {
        name: 'acme__Address__c',
        label: 'Address',
        custom: true,
        queryable: true,
        searchable: true,
      },
    ];
    expect(addresses.map((object) => objectSelectionLabel(object, addresses))).toEqual([
      'Address (Address)',
      'Address (acme__Address__c)',
    ]);
  });

  it('keeps exact object text editable until the user selects a suggestion', () => {
    expect(objectSearchInputState('Address')).toEqual({
      draft: 'Address',
      showSuggestions: true,
      clearSelection: false,
    });
    expect(objectSearchInputState('acme__Address__c')).toEqual({
      draft: 'acme__Address__c',
      showSuggestions: true,
      clearSelection: false,
    });
    expect(objectSearchInputState('')).toEqual({
      draft: '',
      showSuggestions: false,
      clearSelection: true,
    });
  });
});
