import type { QueryRecord, SalesforceFieldSummary } from '@varkole/shared';

export interface RecordFieldRow {
  name: string;
  value: unknown;
  field?: SalesforceFieldSummary | undefined;
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

export function buildRecordFieldRows(
  record: QueryRecord,
  describeFields: SalesforceFieldSummary[] = [],
  filter = '',
): RecordFieldRow[] {
  const metadata = new Map(describeFields.map((field) => [field.name, field]));
  const names = new Set([
    ...describeFields.map((field) => field.name),
    ...Object.keys(record).filter((name) => name !== 'attributes'),
  ]);
  const needle = filter.trim().toLowerCase();
  return [...names]
    .map((name) => ({ name, value: record[name], field: metadata.get(name) }))
    .filter(({ name, value, field }) => {
      if (!needle) return true;
      return [field?.label, name, field?.type, formatSearchValue(value)].some((candidate) =>
        candidate?.toLowerCase().includes(needle),
      );
    })
    .sort((left, right) => {
      const leftLabel = left.field?.label || left.name;
      const rightLabel = right.field?.label || right.name;
      return collator.compare(leftLabel, rightLabel) || collator.compare(left.name, right.name);
    });
}

function formatSearchValue(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  if (typeof value === 'object') return JSON.stringify(value) ?? '';
  return '';
}
