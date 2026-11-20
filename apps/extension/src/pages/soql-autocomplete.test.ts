import { describe, expect, it } from 'vitest';
import type { SalesforceFieldSummary } from '@varkole/shared';
import { applySoqlSuggestion, objectFromSoql, soqlSuggestions } from './soql-autocomplete';

const field = (name: string, label: string): SalesforceFieldSummary => ({
  name,
  label,
  type: 'string',
  custom: false,
  nillable: true,
  filterable: true,
  sortable: true,
  createable: true,
  updateable: true,
});

describe('SOQL autocomplete', () => {
  it('suggests matching fields while typing a select list', () => {
    const query = 'SELECT Na FROM Account';
    expect(soqlSuggestions(query, 9, [field('Name', 'Account Name')])[0]?.value).toBe('Name');
  });

  it('replaces the active token without changing the rest of the query', () => {
    const result = applySoqlSuggestion('SELECT Na FROM Account', 9, {
      value: 'Name',
      label: 'Name',
      detail: 'field',
      kind: 'field',
    });
    expect(result.query).toBe('SELECT Name FROM Account');
  });

  it('extracts the exact API name from FROM', () => {
    expect(objectFromSoql('select Id from ns__Address__c where Name != null')).toBe(
      'ns__Address__c',
    );
  });
});
