import type { QueryRecord } from '@varkole/shared';

export type SortDirection = 'ascending' | 'descending';

export interface TableSort {
  column: string;
  direction: SortDirection;
}

export function sortQueryRecords(records: QueryRecord[], sort?: TableSort): QueryRecord[] {
  if (!sort) return records;

  return records
    .map((record, index) => ({ record, index }))
    .sort((left, right) => {
      const leftValue = getPath(left.record, sort.column);
      const rightValue = getPath(right.record, sort.column);
      const leftMissing = isMissing(leftValue);
      const rightMissing = isMissing(rightValue);
      if (leftMissing && rightMissing) return left.index - right.index;
      if (leftMissing) return 1;
      if (rightMissing) return -1;

      const compared = compareValues(leftValue, rightValue);
      if (compared === 0) return left.index - right.index;
      return sort.direction === 'ascending' ? compared : -compared;
    })
    .map(({ record }) => record);
}

export function nextTableSort(current: TableSort | undefined, column: string): TableSort {
  return {
    column,
    direction:
      current?.column === column && current.direction === 'ascending' ? 'descending' : 'ascending',
  };
}

function compareValues(left: unknown, right: unknown): number {
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  if (typeof left === 'boolean' && typeof right === 'boolean') return Number(left) - Number(right);

  const leftText = sortableText(left);
  const rightText = sortableText(right);
  if (isIsoDate(leftText) && isIsoDate(rightText)) {
    return Date.parse(leftText) - Date.parse(rightText);
  }
  return leftText.localeCompare(rightText, undefined, { numeric: true, sensitivity: 'base' });
}

function isMissing(value: unknown) {
  return value === null || value === undefined || value === '';
}

function sortableText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return JSON.stringify(value) ?? '';
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return `${value}`;
  }
  if (typeof value === 'symbol') return value.description ?? '';
  if (typeof value === 'function') return value.name;
  return '';
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value) && !Number.isNaN(Date.parse(value));
}

function getPath(record: QueryRecord, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (!current || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[key];
  }, record);
}
