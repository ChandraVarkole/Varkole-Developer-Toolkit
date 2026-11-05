import { describe, expect, it } from 'vitest';
import { nextTableSort, sortQueryRecords } from './table-sort';

const records = [
  { Name: 'Account 10', CreatedDate: '2026-11-03T10:00:00.000Z', Score: 2 },
  { Name: null, CreatedDate: '2026-11-01T10:00:00.000Z', Score: 10 },
  { Name: 'Account 2', CreatedDate: '2026-11-02T10:00:00.000Z', Score: 1 },
];

describe('table sorting', () => {
  it('sorts strings naturally and leaves null values last', () => {
    expect(
      sortQueryRecords(records, { column: 'Name', direction: 'ascending' }).map(
        (record) => record.Name,
      ),
    ).toEqual(['Account 2', 'Account 10', null]);
  });

  it('sorts numbers and ISO dates in either direction', () => {
    expect(
      sortQueryRecords(records, { column: 'Score', direction: 'descending' }).map(
        (record) => record.Score,
      ),
    ).toEqual([10, 2, 1]);
    expect(
      sortQueryRecords(records, { column: 'Name', direction: 'descending' }).map(
        (record) => record.Name,
      ),
    ).toEqual(['Account 10', 'Account 2', null]);
    expect(
      sortQueryRecords(records, { column: 'CreatedDate', direction: 'ascending' }).map(
        (record) => record.CreatedDate,
      ),
    ).toEqual(['2026-11-01T10:00:00.000Z', '2026-11-02T10:00:00.000Z', '2026-11-03T10:00:00.000Z']);
  });

  it('toggles the selected column direction', () => {
    expect(nextTableSort(undefined, 'Name')).toEqual({ column: 'Name', direction: 'ascending' });
    expect(nextTableSort({ column: 'Name', direction: 'ascending' }, 'Name')).toEqual({
      column: 'Name',
      direction: 'descending',
    });
  });
});
