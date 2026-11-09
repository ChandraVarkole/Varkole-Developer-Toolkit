import { describe, expect, it } from 'vitest';
import { mergeBuilderFieldsIntoSoql, updateSoqlForObjectChange } from './soql-builder';

describe('SOQL builder updates', () => {
  it('clears a query when the selected object changes', () => {
    expect(
      updateSoqlForObjectChange('SELECT Id FROM Account WHERE Name != null', 'Account', 'Contact'),
    ).toBe('');
  });

  it('keeps a query when the selected object stays the same', () => {
    expect(updateSoqlForObjectChange('SELECT Id FROM Account', 'Account', 'Account')).toBe(
      'SELECT Id FROM Account',
    );
  });

  it('adds selected fields without replacing manually written fields or clauses', () => {
    expect(
      mergeBuilderFieldsIntoSoql(
        "SELECT Id, BillingCity FROM Account WHERE Name LIKE 'A%' ORDER BY Name LIMIT 25",
        'Account',
        ['Name', 'Id'],
      ),
    ).toBe("SELECT Id, BillingCity, Name FROM Account WHERE Name LIKE 'A%' ORDER BY Name LIMIT 25");
  });

  it('starts a fresh query when the editor contains another object', () => {
    expect(mergeBuilderFieldsIntoSoql('SELECT Id FROM Account', 'Contact', ['Id', 'Name'])).toBe(
      'SELECT Id, Name\nFROM Contact\nLIMIT 100',
    );
  });
});
