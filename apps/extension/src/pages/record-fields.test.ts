import { describe, expect, it } from 'vitest';
import type { SalesforceFieldSummary } from '@varkole/shared';
import { buildRecordFieldRows } from './record-fields';

const baseField = {
  custom: false,
  nillable: true,
  filterable: true,
  sortable: true,
  createable: true,
  updateable: true,
} satisfies Omit<SalesforceFieldSummary, 'name' | 'label' | 'type'>;

const fields: SalesforceFieldSummary[] = [
  { ...baseField, name: 'Name', label: 'Account Name', type: 'string' },
  { ...baseField, name: 'AnnualRevenue', label: 'Annual Revenue', type: 'currency' },
  { ...baseField, name: 'Description', label: 'Description', type: 'textarea' },
];

describe('record field rows', () => {
  it('includes described null fields and sorts by field label', () => {
    const rows = buildRecordFieldRows({ Name: 'Acme', AnnualRevenue: 100 }, fields);
    expect(rows.map((row) => row.name)).toEqual(['Name', 'AnnualRevenue', 'Description']);
    expect(rows[2]?.value).toBeUndefined();
  });

  it('searches labels, API names, types, and values', () => {
    expect(buildRecordFieldRows({ Name: 'Acme' }, fields, 'acme').map((row) => row.name)).toEqual([
      'Name',
    ]);
    expect(
      buildRecordFieldRows({ Name: 'Acme' }, fields, 'currency').map((row) => row.name),
    ).toEqual(['AnnualRevenue']);
  });
});
