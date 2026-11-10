import type {
  ImportOperation,
  SalesforceFieldSummary,
  SalesforceObjectDescribe,
} from '@varkole/shared';

export type ImportFieldMapping = Record<string, string>;

export function writableImportFields(
  describe: SalesforceObjectDescribe,
  operation: ImportOperation,
): SalesforceFieldSummary[] {
  if (operation === 'delete') return describe.fields.filter((field) => field.name === 'Id');
  return describe.fields.filter(
    (field) =>
      field.name === 'Id' || (operation === 'insert' ? field.createable : field.updateable),
  );
}

export function autoMapImportHeaders(
  headers: string[],
  describe: SalesforceObjectDescribe,
  operation: ImportOperation,
): ImportFieldMapping {
  const fields = writableImportFields(describe, operation);
  return Object.fromEntries(
    headers.map((header) => {
      const needle = normalize(header);
      const field = fields.find(
        (candidate) =>
          normalize(candidate.name) === needle || normalize(candidate.label) === needle,
      );
      return [header, field?.name ?? ''];
    }),
  );
}

export function buildImportRecords(
  rows: Record<string, string>[],
  mapping: ImportFieldMapping,
  describe: SalesforceObjectDescribe,
  operation: ImportOperation,
): Record<string, unknown>[] {
  const fields = new Map(describe.fields.map((field) => [field.name, field]));
  const mappedFields = Object.values(mapping).filter(Boolean);
  if (new Set(mappedFields).size !== mappedFields.length) {
    throw new Error('Each Salesforce field can be mapped only once.');
  }
  if (operation !== 'insert' && !mappedFields.includes('Id')) {
    throw new Error(
      `${operation === 'delete' ? 'Delete' : 'Update'} requires a CSV column mapped to Id.`,
    );
  }
  if (operation === 'insert' && mappedFields.includes('Id')) {
    throw new Error('Create cannot map a CSV column to Salesforce Id.');
  }
  if (operation === 'update' && !mappedFields.some((field) => field !== 'Id')) {
    throw new Error('Update requires at least one writable field in addition to Id.');
  }
  if (operation === 'insert' && mappedFields.length === 0) {
    throw new Error('Map at least one writable field before creating records.');
  }

  return rows.map((row, index) => {
    const record: Record<string, unknown> = {};
    for (const [header, fieldName] of Object.entries(mapping)) {
      if (!fieldName) continue;
      const field = fields.get(fieldName);
      if (!field)
        throw new Error(`Mapped field ${fieldName} is not available on ${describe.name}.`);
      const raw = row[header] ?? '';
      if (!raw.trim()) continue;
      record[fieldName] = coerceImportValue(raw, field, index + 2);
    }
    if (operation !== 'insert' && typeof record.Id !== 'string') {
      throw new Error(`CSV row ${index + 2} requires a Salesforce record ID.`);
    }
    return operation === 'delete' ? { Id: record.Id } : record;
  });
}

function coerceImportValue(raw: string, field: SalesforceFieldSummary, rowNumber: number): unknown {
  const value = raw.trim();
  if (value === '#NULL!') return null;
  if (field.type === 'boolean') {
    if (/^(true|1)$/i.test(value)) return true;
    if (/^(false|0)$/i.test(value)) return false;
    throw new Error(`CSV row ${rowNumber}: ${field.label} must be true or false.`);
  }
  if (['int', 'long', 'double', 'currency', 'percent'].includes(field.type)) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      throw new Error(`CSV row ${rowNumber}: ${field.label} must be a number.`);
    }
    return number;
  }
  if (
    field.restrictedPicklist &&
    field.picklistValues?.length &&
    !field.picklistValues.some((choice) => choice.active && choice.value === raw)
  ) {
    throw new Error(`CSV row ${rowNumber}: ${raw} is not an active value for ${field.label}.`);
  }
  return raw;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}
