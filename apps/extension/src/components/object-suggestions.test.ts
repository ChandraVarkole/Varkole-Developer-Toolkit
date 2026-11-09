import { describe, expect, it } from 'vitest';
import type { SalesforceObjectSummary } from '@varkole/shared';
import {
  matchingObjectSuggestions,
  objectDisplayLabel,
  sortSalesforceObjects,
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

  it('waits for two characters and returns only matching objects', () => {
    expect(matchingObjectSuggestions(objects, 'a')).toEqual([]);
    expect(matchingObjectSuggestions(objects, 'al').map((object) => object.name)).toEqual([
      'Alpha_Missing__c',
    ]);
  });
});
