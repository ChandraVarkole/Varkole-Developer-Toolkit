import { useMemo, useState } from 'react';
import type { OrgIdentity, QueryPage, QueryRecord } from '@varkole/shared';
import { sendMessage } from '../api';
import { InlineError, EmptyState } from '../components/Status';
import { nextTableSort, sortQueryRecords, type TableSort } from '../components/table-sort';
import { useAutoLoad } from '../useAutoLoad';

const LOG_QUERY =
  'SELECT Id, StartTime, LogUser.Name, Operation, Status, LogLength, DurationMilliseconds, Request, Application FROM ApexLog ORDER BY StartTime DESC LIMIT 50';
const GLOBAL_SEARCH_BYTE_LIMIT = 12 * 1024 * 1024;

export function DebugLogsPage({ org }: { org?: OrgIdentity | undefined }) {
  const [result, setResult] = useState<QueryPage>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [metadataFilter, setMetadataFilter] = useState('');
  const [sort, setSort] = useState<TableSort>();
  const [selectedId, setSelectedId] = useState<string>();
  const [bodies, setBodies] = useState<Map<string, string>>(() => new Map());
  const [bodyLoading, setBodyLoading] = useState(false);
  const [bodySearch, setBodySearch] = useState('');
  const [globalSearch, setGlobalSearch] = useState('');
  const [searchedTerm, setSearchedTerm] = useState('');
  const [matchingIds, setMatchingIds] = useState<Set<string>>();
  const [searchingAll, setSearchingAll] = useState(false);
  const [searchProgress, setSearchProgress] = useState({ complete: 0, total: 0, skipped: 0 });

  async function loadLogs() {
    if (!org) return;
    setLoading(true);
    setError(undefined);
    setMatchingIds(undefined);
    setSearchedTerm('');
    try {
      setResult(
        await sendMessage<QueryPage>({
          type: 'RUN_QUERY',
          payload: {
            key: org.key,
            soql: LOG_QUERY,
            mode: 'tooling',
            requestId: crypto.randomUUID(),
          },
        }),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Salesforce could not load debug logs.');
    } finally {
      setLoading(false);
    }
  }

  useAutoLoad(loadLogs, org?.key);

  async function openLog(record: QueryRecord) {
    if (!org || typeof record.Id !== 'string') return;
    setSelectedId(record.Id);
    setBodySearch('');
    if (bodies.has(record.Id)) return;
    setBodyLoading(true);
    setError(undefined);
    try {
      const body = await sendMessage<string>({
        type: 'GET_APEX_LOG_BODY',
        payload: { key: org.key, logId: record.Id },
      });
      setBodies((current) => new Map(current).set(record.Id as string, body));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Salesforce could not load the log body.');
    } finally {
      setBodyLoading(false);
    }
  }

  async function searchAllBodies() {
    if (!org || !result || !globalSearch.trim()) return;
    const term = globalSearch.trim().toLowerCase();
    const orgKey = org.key;
    const eligible: QueryRecord[] = [];
    let expectedBytes = 0;
    let skipped = 0;
    for (const record of result.records) {
      const length = typeof record.LogLength === 'number' ? record.LogLength : 0;
      if (expectedBytes + length > GLOBAL_SEARCH_BYTE_LIMIT) {
        skipped += 1;
      } else {
        expectedBytes += length;
        eligible.push(record);
      }
    }

    setSearchingAll(true);
    setError(undefined);
    setSearchProgress({ complete: 0, total: eligible.length, skipped });
    const nextBodies = new Map(bodies);
    const matches = new Set<string>();
    let failed = 0;
    let cursor = 0;

    async function worker() {
      while (cursor < eligible.length) {
        const record = eligible[cursor++];
        const id = typeof record?.Id === 'string' ? record.Id : undefined;
        if (!id) continue;
        try {
          let body = nextBodies.get(id);
          if (body === undefined) {
            body = await sendMessage<string>({
              type: 'GET_APEX_LOG_BODY',
              payload: { key: orgKey, logId: id },
            });
            nextBodies.set(id, body);
          }
          if (body.toLowerCase().includes(term)) matches.add(id);
        } catch {
          failed += 1;
        } finally {
          setSearchProgress((current) => ({ ...current, complete: current.complete + 1 }));
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(4, eligible.length) }, () => worker()));
    setBodies(nextBodies);
    setMatchingIds(matches);
    setSearchedTerm(globalSearch.trim());
    setSearchingAll(false);
    if (failed)
      setError(
        `${failed} log ${failed === 1 ? 'body was' : 'bodies were'} unavailable to the current Salesforce user.`,
      );
  }

  const visibleRecords = useMemo(() => {
    const needle = metadataFilter.trim().toLowerCase();
    const filtered = (result?.records ?? []).filter((record) => {
      if (matchingIds && (typeof record.Id !== 'string' || !matchingIds.has(record.Id)))
        return false;
      if (!needle) return true;
      return [
        record.Id,
        record.StartTime,
        record.Operation,
        record.Status,
        record.Request,
        record.Application,
        nestedValue(record, 'LogUser.Name'),
      ].some((value) => formatValue(value).toLowerCase().includes(needle));
    });
    return sortQueryRecords(filtered, sort);
  }, [metadataFilter, matchingIds, result, sort]);
  const selectedRecord = result?.records.find((record) => record.Id === selectedId);
  const selectedBody = selectedId ? bodies.get(selectedId) : undefined;

  if (!org) {
    return (
      <EmptyState
        title="Open a Salesforce org"
        description="Debug logs use the current Salesforce browser session."
      />
    );
  }

  return (
    <div className="page-stack debug-logs-page">
      <header className="page-header">
        <div>
          <div className="eyebrow">Developer logs · read-only</div>
          <h1>Debug Logs</h1>
        </div>
        <button
          className="button button-primary"
          type="button"
          disabled={loading}
          onClick={() => void loadLogs()}
        >
          {loading ? 'Loading…' : 'Refresh logs'}
        </button>
      </header>

      <section className="section-card compact-section module-guidance" role="note">
        <div>
          <h2>Debug logging must be enabled</h2>
          <p>Enable a trace flag in Setup → Debug Logs, reproduce the activity, then refresh.</p>
        </div>
      </section>

      <section className="log-search-card">
        <div>
          <strong>Search inside all loaded logs</strong>
          <span>Searches {result?.records.length ?? 0} loaded logs locally, up to 12 MB.</span>
        </div>
        <div className="log-global-search">
          <input
            value={globalSearch}
            onChange={(event) => setGlobalSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void searchAllBodies();
            }}
            placeholder="Search USER_DEBUG, exception text, class name…"
          />
          <button
            className="button button-secondary"
            type="button"
            disabled={searchingAll || !globalSearch.trim() || !result?.records.length}
            onClick={() => void searchAllBodies()}
          >
            {searchingAll
              ? `${searchProgress.complete}/${searchProgress.total}`
              : 'Search all logs'}
          </button>
          {matchingIds && (
            <button
              className="button button-ghost"
              type="button"
              onClick={() => {
                setMatchingIds(undefined);
                setSearchedTerm('');
              }}
            >
              Clear
            </button>
          )}
        </div>
        {searchedTerm && (
          <p className="log-search-summary">
            {matchingIds?.size ?? 0} logs contain “{searchedTerm}”.
            {searchProgress.skipped
              ? ` ${searchProgress.skipped} oversized logs were skipped by the 12 MB safety limit.`
              : ''}
          </p>
        )}
      </section>

      <InlineError message={error} />

      <section className="results-card">
        <div className="results-toolbar">
          <div className="result-stats">
            <strong>{visibleRecords.length}</strong> visible logs
            <span>{result?.elapsedMs ?? 0} ms</span>
            <span>Developer logs</span>
          </div>
          <label className="result-filter">
            <span className="sr-only">Filter log metadata</span>
            <input
              value={metadataFilter}
              onChange={(event) => setMetadataFilter(event.target.value)}
              placeholder="Filter log metadata…"
            />
          </label>
        </div>
        {!result?.records.length ? (
          <div className="empty-results">
            <strong>No debug logs found</strong>
            <p>Enable a trace flag, reproduce the transaction, and refresh this tab.</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  {[
                    'StartTime',
                    'LogUser.Name',
                    'Operation',
                    'Status',
                    'LogLength',
                    'DurationMilliseconds',
                  ].map((column) => (
                    <th key={column} aria-sort={sort?.column === column ? sort.direction : 'none'}>
                      <button
                        className="sort-button"
                        type="button"
                        onClick={() => setSort((current) => nextTableSort(current, column))}
                      >
                        <span>{logColumnLabel(column)}</span>
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
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleRecords.map((record, index) => (
                  <tr
                    key={String(record.Id)}
                    className={record.Id === selectedId ? 'selected-log-row' : ''}
                  >
                    <td className="row-number">{index + 1}</td>
                    <td>{formatValue(record.StartTime)}</td>
                    <td>{formatValue(nestedValue(record, 'LogUser.Name'))}</td>
                    <td>{formatValue(record.Operation)}</td>
                    <td>{formatValue(record.Status)}</td>
                    <td>{formatBytes(record.LogLength)}</td>
                    <td>{formatValue(record.DurationMilliseconds)} ms</td>
                    <td>
                      <button
                        className="button button-ghost"
                        type="button"
                        onClick={() => void openLog(record)}
                      >
                        View log
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedId && (
        <LogViewer
          record={selectedRecord}
          body={selectedBody}
          loading={bodyLoading}
          search={bodySearch}
          onSearch={setBodySearch}
          onClose={() => setSelectedId(undefined)}
        />
      )}
    </div>
  );
}

function LogViewer({
  record,
  body,
  loading,
  search,
  onSearch,
  onClose,
}: {
  record: QueryRecord | undefined;
  body: string | undefined;
  loading: boolean;
  search: string;
  onSearch: (value: string) => void;
  onClose: () => void;
}) {
  const lines = useMemo(() => {
    const all = (body ?? '').split(/\r?\n/);
    const needle = search.trim().toLowerCase();
    return all
      .map((text, index) => ({ text, number: index + 1 }))
      .filter(({ text }) => !needle || text.toLowerCase().includes(needle));
  }, [body, search]);

  function download() {
    if (!body || typeof record?.Id !== 'string') return;
    const url = URL.createObjectURL(new Blob([body], { type: 'text/plain;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${record.Id}.log`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="log-viewer">
      <div className="log-viewer-header">
        <div>
          <div className="eyebrow">Debug log body</div>
          <h2>{formatValue(record?.Operation) || 'Apex log'}</h2>
          <p>
            {formatValue(record?.StartTime)} · {formatValue(nestedValue(record, 'LogUser.Name'))}
          </p>
        </div>
        <div>
          <button
            className="button button-secondary"
            type="button"
            disabled={!body}
            onClick={download}
          >
            Download
          </button>
          <button className="button button-ghost" type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
      <div className="log-viewer-search">
        <input
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Search within this log…"
        />
        {search && <span>{lines.length} matching lines</span>}
      </div>
      {loading ? (
        <p className="muted log-loading">Loading log body…</p>
      ) : body !== undefined ? (
        <ol className="log-lines">
          {lines.map((line) => (
            <li key={line.number} value={line.number}>
              <code>{highlight(line.text, search)}</code>
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted log-loading">The log body is unavailable.</p>
      )}
    </section>
  );
}

function highlight(text: string, search: string) {
  const needle = search.trim();
  if (!needle) return text;
  const index = text.toLowerCase().indexOf(needle.toLowerCase());
  if (index < 0) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + needle.length)}</mark>
      {text.slice(index + needle.length)}
    </>
  );
}

function nestedValue(record: QueryRecord | undefined, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (current, key) =>
        current && typeof current === 'object'
          ? (current as Record<string, unknown>)[key]
          : undefined,
      record,
    );
}

function formatValue(value: unknown) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint')
    return String(value);
  return '';
}

function formatBytes(value: unknown) {
  if (typeof value !== 'number') return '';
  if (value < 1024) return `${value} B`;
  return `${(value / 1024).toFixed(value < 10240 ? 1 : 0)} KB`;
}

function logColumnLabel(column: string) {
  return (
    (
      {
        StartTime: 'Start time',
        'LogUser.Name': 'User',
        Operation: 'Operation',
        Status: 'Status',
        LogLength: 'Size',
        DurationMilliseconds: 'Duration',
      } as Record<string, string>
    )[column] ?? column
  );
}
