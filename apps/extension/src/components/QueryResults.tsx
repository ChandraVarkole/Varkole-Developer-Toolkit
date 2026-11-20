import { useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { QueryPage, QueryRecord } from '@varkole/shared';
import { CopyButton } from './CopyButton';
import { TableActions } from './TableActions';
import { isCopyableTechnicalValue } from './copyable-values';
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
  copyableColumns,
  expandTable = false,
  clientPageSize,
  filterPlaceholder = 'Search loaded records…',
}: {
  result: QueryPage;
  pageNumber: number;
  modeLabel: string;
  loading: boolean;
  onNext?: (() => void) | undefined;
  recordBaseUrl?: string | undefined;
  columnLabels?: Record<string, string> | undefined;
  hiddenColumns?: string[] | undefined;
  copyableColumns?: string[] | undefined;
  expandTable?: boolean | undefined;
  clientPageSize?: number | undefined;
  filterPlaceholder?: string | undefined;
}) {
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState<TableSort>();
  const [clientPage, setClientPage] = useState(1);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const columns = useMemo(
    () => resultColumns(result.records).filter((column) => !hiddenColumns?.includes(column)),
    [hiddenColumns, result.records],
  );
  const filteredRows = useMemo(() => {
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
  const clientPageCount = clientPageSize
    ? Math.max(1, Math.ceil(filteredRows.length / clientPageSize))
    : 1;
  const currentClientPage = Math.min(clientPage, clientPageCount);
  const visibleRows = useMemo(
    () =>
      clientPageSize
        ? filteredRows.slice(
            (currentClientPage - 1) * clientPageSize,
            currentClientPage * clientPageSize,
          )
        : filteredRows,
    [clientPageSize, currentClientPage, filteredRows],
  );
  const hasRecordLinks = Boolean(
    recordBaseUrl && visibleRows.some((record) => recordIdFromQueryRecord(record)),
  );
  const defaultWidths = useMemo(
    () =>
      Object.fromEntries(
        columns.map((column) => [
          column,
          initialColumnWidth(
            columnLabels?.[column] ?? humanizeColumn(column),
            result.records.slice(0, 50).map((record) => formatCell(getPath(record, column))),
          ),
        ]),
      ),
    [columnLabels, columns, result.records],
  );
  const widthFor = (column: string) => columnWidths[column] ?? defaultWidths[column] ?? 160;
  const tableMinWidth =
    52 + (hasRecordLinks ? 62 : 0) + columns.reduce((sum, column) => sum + widthFor(column), 0);

  function resizeColumn(column: string, width: number) {
    setColumnWidths((current) => ({ ...current, [column]: Math.round(clamp(width, 88, 720)) }));
  }

  function startColumnResize(event: ReactPointerEvent<HTMLSpanElement>, column: string) {
    event.preventDefault();
    event.stopPropagation();
    const startingX = event.clientX;
    const startingWidth = widthFor(column);
    const move = (pointerEvent: PointerEvent) =>
      resizeColumn(column, startingWidth + pointerEvent.clientX - startingX);
    const finish = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish, { once: true });
    window.addEventListener('pointercancel', finish, { once: true });
  }

  return (
    <section
      className={`results-card ${expandTable ? 'results-card-expanded' : ''}`}
      aria-label={`${modeLabel} query results`}
    >
      <div className="results-toolbar">
        <div className="result-stats">
          <strong>{result.totalSize.toLocaleString()}</strong> total rows
          {clientPageSize ? (
            <span>
              Page {currentClientPage} of {clientPageCount}
            </span>
          ) : (
            (pageNumber > 1 || result.nextRecordsUrl) && <span>Page {pageNumber}</span>
          )}
        </div>
        <TableActions
          rows={filteredRows}
          columns={columns}
          columnLabels={columnLabels}
          fileName={`${modeLabel}-results`}
        />
        <label className="result-filter">
          <span className="sr-only">Search all loaded records</span>
          <input
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value);
              setClientPage(1);
            }}
            placeholder={filterPlaceholder}
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
          <table className="results-data-table" style={{ minWidth: `${tableMinWidth}px` }}>
            <colgroup>
              <col style={{ width: '52px' }} />
              {hasRecordLinks && <col style={{ width: '62px' }} />}
              {columns.map((column) => (
                <col key={column} style={{ width: `${widthFor(column)}px` }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th>#</th>
                {hasRecordLinks && <th className="record-open-heading">Open</th>}
                {columns.map((column) => (
                  <th
                    className="resizable-heading"
                    key={column}
                    aria-sort={sort?.column === column ? sort.direction : 'none'}
                  >
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
                    <span
                      className="column-resize-handle"
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={`Resize ${columnLabels?.[column] ?? humanizeColumn(column)} column`}
                      tabIndex={0}
                      onPointerDown={(event) => startColumnResize(event, column)}
                      onDoubleClick={() =>
                        setColumnWidths((current) => {
                          const next = { ...current };
                          delete next[column];
                          return next;
                        })
                      }
                      onKeyDown={(event) => {
                        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
                        event.preventDefault();
                        resizeColumn(
                          column,
                          widthFor(column) + (event.key === 'ArrowRight' ? 24 : -24),
                        );
                      }}
                    />
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
                    <td className="row-number">
                      {index + 1 + (clientPageSize ? (currentClientPage - 1) * clientPageSize : 0)}
                    </td>
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
                      const copyable =
                        Boolean(value) &&
                        (copyableColumns?.includes(column) ||
                          isCopyableTechnicalValue(column, value));
                      return (
                        <td key={column} className={recordUrl ? 'mono cell-id' : ''} title={value}>
                          <span className="table-cell-value">
                            {recordUrl ? (
                              <a href={recordUrl} target="_blank" rel="noreferrer noopener">
                                {value}
                              </a>
                            ) : (
                              value || <span className="null">null</span>
                            )}
                            {copyable && (
                              <CopyButton
                                value={value}
                                label={`Copy ${humanizeColumn(column)}`}
                                compact
                              />
                            )}
                          </span>
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
        <span>
          Showing {visibleRows.length.toLocaleString()} of {filteredRows.length.toLocaleString()}{' '}
          matching rows
        </span>
        {clientPageSize && clientPageCount > 1 && (
          <div className="results-pagination">
            <button
              className="button button-secondary button-compact"
              type="button"
              disabled={currentClientPage === 1}
              onClick={() => setClientPage(Math.max(1, currentClientPage - 1))}
            >
              ← Previous
            </button>
            <button
              className="button button-secondary button-compact"
              type="button"
              disabled={currentClientPage === clientPageCount}
              onClick={() => setClientPage(Math.min(clientPageCount, currentClientPage + 1))}
            >
              Next →
            </button>
          </div>
        )}
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

function initialColumnWidth(label: string, values: string[]): number {
  const longestValue = values
    .slice(0, 50)
    .reduce((length, value) => Math.max(length, Math.min(value.length, 42)), 0);
  return Math.round(clamp(48 + Math.max(label.length, longestValue) * 7.2, 128, 360));
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
