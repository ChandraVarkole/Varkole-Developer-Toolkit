import { useMemo, useState } from 'react';
import type { QueryPage, QueryRecord } from '@varkole/shared';
import { recordIdFromQueryRecord, recordUrlForCell, salesforceRecordUrl } from './record-links';
import { nextTableSort, sortQueryRecords, type TableSort } from './table-sort';

export function QueryResults({
  result,
  pageNumber,
  modeLabel,
  loading,
  onNext,
  recordBaseUrl,
  columnLabels,
  hiddenColumns,
}: {
  result: QueryPage;
  pageNumber: number;
  modeLabel: string;
  loading: boolean;
  onNext?: (() => void) | undefined;
  recordBaseUrl?: string | undefined;
  columnLabels?: Record<string, string> | undefined;
  hiddenColumns?: string[] | undefined;
}) {
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState<TableSort>();
  const columns = useMemo(
    () => resultColumns(result.records).filter((column) => !hiddenColumns?.includes(column)),
    [hiddenColumns, result.records],
  );
  const visibleRows = useMemo(() => {
    const filtered = filter.trim()
      ? result.records.filter((record) => {
          const needle = filter.toLowerCase();
          return columns.some((column) =>
            formatCell(getPath(record, column)).toLowerCase().includes(needle),
          );
        })
      : result.records;
    return sortQueryRecords(filtered, sort);
  }, [columns, filter, result.records, sort]);
  const hasRecordLinks = Boolean(
    recordBaseUrl && visibleRows.some((record) => recordIdFromQueryRecord(record)),
  );

  return (
    <section className="results-card">
      <div className="results-toolbar">
        <div className="result-stats">
          <strong>{result.totalSize.toLocaleString()}</strong> total rows
          <span>Page {pageNumber}</span>
          <span>{result.elapsedMs} ms</span>
          <span>{modeLabel}</span>
          {result.apiUsage && <span>{result.apiUsage}</span>}
          {recordBaseUrl && <span>{new URL(recordBaseUrl).hostname}</span>}
        </div>
        <label className="result-filter">
          <span className="sr-only">Filter current page</span>
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter this page…"
          />
        </label>
      </div>
      {result.records.length === 0 ? (
        <div className="empty-results">
          <strong>Request completed</strong>
          <p>Salesforce returned no records.</p>
        </div>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>#</th>
                {hasRecordLinks && <th className="record-open-heading">Open</th>}
                {columns.map((column) => (
                  <th key={column} aria-sort={sort?.column === column ? sort.direction : 'none'}>
                    <button
                      className="sort-button"
                      type="button"
                      onClick={() => setSort((current) => nextTableSort(current, column))}
                      title={`Sort by ${columnLabels?.[column] ?? humanizeColumn(column)}`}
                    >
                      <span>{columnLabels?.[column] ?? humanizeColumn(column)}</span>
                      <span aria-hidden="true">
                        {sort?.column === column
                          ? sort.direction === 'ascending'
                            ? '↑'
                            : '↓'
                          : '↕'}
                      </span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((record, index) => {
                const recordId = recordIdFromQueryRecord(record);
                const rowUrl = salesforceRecordUrl(recordBaseUrl, recordId);
                return (
                  <tr key={record.attributes?.url ?? index}>
                    <td className="row-number">{index + 1}</td>
                    {hasRecordLinks && (
                      <td className="record-open-cell">
                        {rowUrl && (
                          <a
                            className="record-open-link"
                            href={rowUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                            aria-label={`Open record ${recordId} in Salesforce`}
                            title="Open record in Salesforce"
                          >
                            ↗
                          </a>
                        )}
                      </td>
                    )}
                    {columns.map((column) => {
                      const value = formatCell(getPath(record, column));
                      const recordUrl = recordUrlForCell(recordBaseUrl, column, value);
                      return (
                        <td key={column} className={recordUrl ? 'mono cell-id' : ''} title={value}>
                          {recordUrl ? (
                            <a href={recordUrl} target="_blank" rel="noreferrer noopener">
                              {value}
                            </a>
                          ) : (
                            value || <span className="null">null</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="results-footer">
        <span>Showing {visibleRows.length.toLocaleString()} rows on this page</span>
        {result.nextRecordsUrl && onNext && (
          <button
            className="button button-secondary"
            type="button"
            disabled={loading}
            onClick={onNext}
          >
            Load next page →
          </button>
        )}
      </div>
    </section>
  );
}

function humanizeColumn(column: string): string {
  const parts = column.split('.');
  const leaf = parts.at(-1) ?? column;
  if (leaf === 'Name' && parts.length > 1) return humanizeToken(parts.at(-2) ?? leaf);
  return parts.map(humanizeToken).join(' · ');
}

function humanizeToken(value: string): string {
  if (value === 'Id') return 'ID';
  return value
    .replace(/^Is(?=[A-Z])/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\bApi\b/g, 'API')
    .replace(/\bId\b/g, 'ID');
}

function resultColumns(records: QueryRecord[]): string[] {
  const columns = new Set<string>();
  for (const record of records.slice(0, 100)) collectColumns(record, '', columns);
  return [...columns];
}

function collectColumns(value: unknown, prefix: string, columns: Set<string>) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    if (prefix) columns.add(prefix);
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (key === 'attributes') continue;
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      collectColumns(child, path, columns);
    } else {
      columns.add(path);
    }
  }
}

function getPath(record: QueryRecord, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (!current || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[key];
  }, record);
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  return '';
}
