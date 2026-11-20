import { useState } from 'react';
import { exportTableRows, tableDelimitedText } from './table-export';

export function TableActions({
  rows,
  columns,
  columnLabels = {},
  fileName = 'varkole-data',
}: {
  rows: Record<string, unknown>[];
  columns: string[];
  columnLabels?: Record<string, string> | undefined;
  fileName?: string | undefined;
}) {
  const [copied, setCopied] = useState(false);
  const disabled = rows.length === 0 || columns.length === 0;

  async function copy() {
    await navigator.clipboard.writeText(tableDelimitedText(rows, columns, columnLabels, '\t'));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_500);
  }

  function download(format: 'csv' | 'json') {
    const content =
      format === 'csv'
        ? tableDelimitedText(rows, columns, columnLabels)
        : JSON.stringify(exportTableRows(rows, columns), null, 2);
    const type = format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8';
    const url = URL.createObjectURL(new Blob([content], { type }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${safeFileName(fileName)}.${format}`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="table-actions" aria-label="Table actions">
      <button
        className="button button-ghost button-compact"
        type="button"
        disabled={disabled}
        onClick={() => void copy()}
      >
        {copied ? 'Copied' : 'Copy table'}
      </button>
      <button
        className="button button-ghost button-compact"
        type="button"
        disabled={disabled}
        onClick={() => download('csv')}
      >
        CSV
      </button>
      <button
        className="button button-ghost button-compact"
        type="button"
        disabled={disabled}
        onClick={() => download('json')}
      >
        JSON
      </button>
    </div>
  );
}

function safeFileName(value: string): string {
  return (
    value
      .trim()
      .replace(/[^A-Za-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'varkole-data'
  );
}
