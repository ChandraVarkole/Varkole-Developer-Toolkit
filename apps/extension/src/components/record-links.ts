import type { QueryRecord } from '@varkole/shared';

const SALESFORCE_ID = /^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/;

export function recordIdFromQueryRecord(record: QueryRecord): string | undefined {
  if (typeof record.Id === 'string' && SALESFORCE_ID.test(record.Id)) return record.Id;
  const path = record.attributes?.url;
  if (!path) return undefined;
  const candidate = path.split('/').filter(Boolean).at(-1);
  return candidate && SALESFORCE_ID.test(candidate) ? candidate : undefined;
}

export function recordUrlForCell(
  baseUrl: string | undefined,
  column: string,
  value: string,
): string | undefined {
  const leafField = column.split('.').at(-1) ?? '';
  if (!baseUrl || !leafField.endsWith('Id') || !SALESFORCE_ID.test(value)) return undefined;
  return salesforceRecordUrl(baseUrl, value);
}

export function salesforceRecordUrl(
  baseUrl: string | undefined,
  recordId: string | undefined,
): string | undefined {
  if (!baseUrl || !recordId || !SALESFORCE_ID.test(recordId)) return undefined;
  try {
    const origin = new URL(baseUrl).origin;
    return `${origin}/${recordId}`;
  } catch {
    return undefined;
  }
}
