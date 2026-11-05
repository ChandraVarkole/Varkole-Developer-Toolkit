import type { QueryRecord } from '@varkole/shared';

export function recordsToCsv(records: QueryRecord[]): string {
  const flattened = records.map(flattenRecord);
  const columns = [...new Set(flattened.flatMap((record) => Object.keys(record)))];
  const lines = [columns.map(csvCell).join(',')];
  for (const record of flattened) {
    lines.push(columns.map((column) => csvCell(record[column])).join(','));
  }
  return lines.join('\r\n');
}

export function recordsToJson(records: QueryRecord[]): string {
  return JSON.stringify(
    records.map((record) =>
      Object.fromEntries(Object.entries(record).filter(([key]) => key !== 'attributes')),
    ),
    null,
    2,
  );
}

function flattenRecord(record: QueryRecord): Record<string, unknown> {
  const flattened: Record<string, unknown> = {};
  collect(record, '', flattened);
  return flattened;
}

function collect(value: unknown, prefix: string, target: Record<string, unknown>) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    if (prefix) target[prefix] = value;
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (key === 'attributes') continue;
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) collect(child, path, target);
    else target[path] = child;
  }
}

function csvCell(value: unknown): string {
  let text = '';
  if (typeof value === 'string') text = value;
  else if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    text = String(value);
  } else if (value && typeof value === 'object') {
    text = JSON.stringify(value);
  }
  if (/^\s*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
