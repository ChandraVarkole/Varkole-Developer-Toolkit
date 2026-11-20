export function exportTableRows(
  rows: Record<string, unknown>[],
  columns: string[],
): Record<string, unknown>[] {
  return rows.map((row) =>
    Object.fromEntries(columns.map((column) => [column, tableValue(row, column)])),
  );
}

export function tableDelimitedText(
  rows: Record<string, unknown>[],
  columns: string[],
  labels: Record<string, string> = {},
  delimiter = ',',
): string {
  const lines = [columns.map((column) => escapeCell(labels[column] ?? column, delimiter))];
  for (const row of rows) {
    lines.push(
      columns.map((column) => escapeCell(formatTableValue(tableValue(row, column)), delimiter)),
    );
  }
  return lines.map((line) => line.join(delimiter)).join('\n');
}

export function tableValue(row: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (!current || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[key];
  }, row);
}

function escapeCell(value: string, delimiter: string): string {
  if (!value.includes(delimiter) && !/["\r\n]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

function formatTableValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return `${value}`;
  }
  if (typeof value === 'symbol') return value.description ?? '';
  return '';
}
