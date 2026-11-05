const API_NAME = /^[A-Za-z][A-Za-z0-9_]*$/;
const FIELD_PATH = /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)*$/;
const RECORD_ID = /^[A-Za-z0-9]{15}(?:[A-Za-z0-9]{3})?$/;

export interface RecordsQueryInput {
  objectApiName: string;
  fields: string;
  recordId?: string | undefined;
  limit?: number | undefined;
  inspectAllFields?: boolean | undefined;
}

export function buildRecordsQuery(input: RecordsQueryInput): string {
  const objectApiName = input.objectApiName.trim();
  if (!API_NAME.test(objectApiName)) {
    throw new Error('Enter a valid Salesforce object API name, such as Account or Invoice__c.');
  }

  const recordId = input.recordId?.trim();
  if (recordId && !RECORD_ID.test(recordId)) {
    throw new Error('A Salesforce record ID must contain 15 or 18 letters and numbers.');
  }

  const fields = input.fields
    .split(',')
    .map((field) => field.trim())
    .filter(Boolean);
  if (
    !(recordId && input.inspectAllFields) &&
    (fields.length === 0 || fields.some((field) => !FIELD_PATH.test(field)))
  ) {
    throw new Error('Enter comma-separated Salesforce field API names.');
  }

  const limit = Math.min(Math.max(Math.trunc(input.limit ?? 100), 1), 200);
  return [
    `SELECT ${recordId && input.inspectAllFields ? 'FIELDS(ALL)' : fields.join(', ')}`,
    `FROM ${objectApiName}`,
    ...(recordId ? [`WHERE Id = '${recordId}'`] : []),
    `LIMIT ${recordId ? 1 : limit}`,
  ].join('\n');
}
import type { SalesforceObjectSummary } from '@varkole/shared';

export function inferObjectFromRecordId(
  recordId: string,
  objects: SalesforceObjectSummary[],
): SalesforceObjectSummary | undefined {
  const normalized = recordId.trim();
  if (!RECORD_ID.test(normalized)) return undefined;
  const prefix = normalized.slice(0, 3).toLowerCase();
  return objects.find((object) => object.keyPrefix?.toLowerCase() === prefix);
}
