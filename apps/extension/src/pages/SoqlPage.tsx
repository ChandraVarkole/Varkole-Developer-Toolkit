import { useEffect, useState } from 'react';
import type { ApiMode, OrgIdentity, QueryPage, SoqlHistoryEntry } from '@varkole/shared';
import { sendMessage } from '../api';
import { ObjectFieldPicker } from '../components/ObjectFieldPicker';
import { QueryResults } from '../components/QueryResults';
import { EmptyState, InlineError } from '../components/Status';
import { orgName } from '../org';
import { mergeBuilderFieldsIntoSoql, updateSoqlForObjectChange } from './soql-builder';

const DEFAULT_QUERY = '';

export function SoqlPage({ org }: { org?: OrgIdentity | undefined }) {
  const [soql, setSoql] = useState(DEFAULT_QUERY);
  const [mode, setMode] = useState<ApiMode>('rest');
  const [result, setResult] = useState<QueryPage>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [requestId, setRequestId] = useState<string>();
  const [pageNumber, setPageNumber] = useState(1);
  const [builderObject, setBuilderObject] = useState('');
  const [builderFields, setBuilderFields] = useState<string[]>([]);
  const [history, setHistory] = useState<SoqlHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string>();

  useEffect(() => {
    if (!org) {
      setHistory([]);
      return;
    }
    let active = true;
    void sendMessage<SoqlHistoryEntry[]>({
      type: 'GET_QUERY_HISTORY',
      payload: { key: org.key },
    })
      .then((next) => {
        if (active) setHistory(next);
      })
      .catch((cause: unknown) => {
        if (active) {
          setHistoryError(cause instanceof Error ? cause.message : 'Query history could not load.');
        }
      });
    return () => {
      active = false;
    };
  }, [org]);

  async function run(saveToHistory = true) {
    if (!org || !soql.trim()) return;
    const id = crypto.randomUUID();
    setRequestId(id);
    setLoading(true);
    setError(undefined);
    setPageNumber(1);
    try {
      const nextResult = await sendMessage<QueryPage>({
        type: 'RUN_QUERY',
        payload: { key: org.key, soql, mode, requestId: id },
      });
      setResult(nextResult);
      if (saveToHistory) {
        try {
          setHistory(
            await sendMessage<SoqlHistoryEntry[]>({
              type: 'SAVE_QUERY_HISTORY',
              payload: { key: org.key, soql, mode },
            }),
          );
          setHistoryError(undefined);
        } catch (cause) {
          setHistoryError(
            cause instanceof Error ? cause.message : 'The query ran, but history could not save.',
          );
        }
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The query could not be completed.');
    } finally {
      setLoading(false);
      setRequestId(undefined);
    }
  }

  async function nextPage() {
    if (!org || !result?.nextRecordsUrl) return;
    const id = crypto.randomUUID();
    setRequestId(id);
    setLoading(true);
    setError(undefined);
    try {
      setResult(
        await sendMessage<QueryPage>({
          type: 'QUERY_NEXT',
          payload: { key: org.key, nextRecordsUrl: result.nextRecordsUrl, requestId: id },
        }),
      );
      setPageNumber((page) => page + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The next page could not be loaded.');
    } finally {
      setLoading(false);
      setRequestId(undefined);
    }
  }

  async function cancel() {
    if (!requestId) return;
    await sendMessage<void>({ type: 'CANCEL_REQUEST', payload: { requestId } });
  }

  async function deleteHistoryEntry(id: string) {
    if (!org) return;
    setHistoryError(undefined);
    try {
      setHistory(
        await sendMessage<SoqlHistoryEntry[]>({
          type: 'DELETE_QUERY_HISTORY',
          payload: { key: org.key, id },
        }),
      );
    } catch (cause) {
      setHistoryError(
        cause instanceof Error ? cause.message : 'The history entry could not delete.',
      );
    }
  }

  async function clearHistory() {
    if (!org || !window.confirm('Clear all saved query history for this Salesforce org?')) return;
    setHistoryError(undefined);
    try {
      setHistory(
        await sendMessage<SoqlHistoryEntry[]>({
          type: 'CLEAR_QUERY_HISTORY',
          payload: { key: org.key },
        }),
      );
    } catch (cause) {
      setHistoryError(cause instanceof Error ? cause.message : 'Query history could not clear.');
    }
  }

  function changeBuilderObject(nextObject: string) {
    const changed = builderObject.toLowerCase() !== nextObject.toLowerCase();
    setSoql((current) => updateSoqlForObjectChange(current, builderObject, nextObject));
    setBuilderObject(nextObject);
    if (changed) {
      setBuilderFields([]);
      setResult(undefined);
      setError(undefined);
      setPageNumber(1);
    }
  }

  function applyBuilderFields() {
    setSoql((current) => mergeBuilderFieldsIntoSoql(current, builderObject, builderFields));
    setResult(undefined);
    setError(undefined);
    setPageNumber(1);
  }

  if (!org) {
    return (
      <EmptyState
        title="Connect an org to query"
        description="SOQL runs locally against your authorized Salesforce APIs."
      />
    );
  }
  return (
    <div className="page-stack soql-page">
      <header className="page-header">
        <div>
          <div className="eyebrow">Read-only utility</div>
          <h1>SOQL Explorer</h1>
          <p>Query {orgName(org)}.</p>
        </div>
        <div className="soql-header-actions">
          <button
            className={`button ${showHistory ? 'button-primary' : 'button-secondary'}`}
            type="button"
            onClick={() => setShowHistory((current) => !current)}
          >
            ◷ History <span className="history-count">{history.length}</span>
          </button>
          <label className="mode-select">
            <span>Query type</span>
            <select value={mode} onChange={(event) => setMode(event.target.value as ApiMode)}>
              <option value="rest">Salesforce data</option>
              <option value="tooling">Developer metadata</option>
            </select>
          </label>
        </div>
      </header>

      <InlineError message={historyError} />

      <section className="section-card query-builder-card">
        <ObjectFieldPicker
          org={org}
          objectApiName={builderObject}
          onObjectApiNameChange={changeBuilderObject}
          selectedFields={builderFields}
          onSelectedFieldsChange={setBuilderFields}
          expandedFields
        />
        <div className="section-actions">
          <span />
          <button
            className="button button-secondary"
            type="button"
            disabled={!builderObject.trim() || builderFields.length === 0}
            onClick={applyBuilderFields}
          >
            {soql.trim() ? 'Add fields to query' : 'Build query'}
          </button>
        </div>
      </section>

      {showHistory && (
        <section className="section-card query-history-card">
          <div className="section-title">
            <div>
              <h2>Query history</h2>
            </div>
            {history.length > 0 && (
              <button
                className="button button-ghost danger-text"
                type="button"
                onClick={() => void clearHistory()}
              >
                Clear all
              </button>
            )}
          </div>
          {history.length === 0 ? (
            <div className="query-history-empty">Run a query to save it here for future use.</div>
          ) : (
            <div className="query-history-list">
              {history.map((entry) => (
                <div className="query-history-entry" key={entry.id}>
                  <button
                    className="query-history-restore"
                    type="button"
                    onClick={() => {
                      setSoql(entry.soql);
                      setMode(entry.mode);
                      setResult(undefined);
                      setError(undefined);
                      setPageNumber(1);
                      setShowHistory(false);
                    }}
                  >
                    <span>
                      <b>{entry.mode === 'tooling' ? 'Tooling' : 'REST'}</b>
                      <time dateTime={entry.executedAt}>{formatHistoryTime(entry.executedAt)}</time>
                    </span>
                    <code>{entry.soql.replace(/\s+/g, ' ')}</code>
                  </button>
                  <button
                    className="query-history-delete"
                    type="button"
                    aria-label="Delete query from history"
                    title="Delete from history"
                    onClick={() => void deleteHistoryEntry(entry.id)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="query-card">
        <div className="editor-bar">
          <span>query.soql</span>
          <span>Ctrl / ⌘ + Enter to run</span>
        </div>
        <textarea
          className="query-editor"
          aria-label="SOQL query"
          placeholder="Enter a SOQL query or choose an object and fields above"
          spellCheck={false}
          value={soql}
          onChange={(event) => {
            setSoql(event.target.value);
            setResult(undefined);
            setError(undefined);
            setPageNumber(1);
          }}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
              event.preventDefault();
              void run();
            }
          }}
        />
        <div className="query-actions">
          <span className="muted">No query text or results are sent to Varkole servers.</span>
          {loading ? (
            <button
              className="button button-danger-outline"
              type="button"
              onClick={() => void cancel()}
            >
              Stop query
            </button>
          ) : (
            <button
              className="button button-primary"
              type="button"
              disabled={!soql.trim()}
              onClick={() => void run()}
            >
              {result ? 'Run again' : 'Run query'} <kbd>⌘↵</kbd>
            </button>
          )}
        </div>
      </section>

      <InlineError message={error} />

      {result && (
        <QueryResults
          result={result}
          pageNumber={pageNumber}
          modeLabel={mode === 'tooling' ? 'Developer metadata' : 'Salesforce data'}
          loading={loading}
          onNext={() => void nextPage()}
          recordBaseUrl={org.instanceUrl}
        />
      )}
    </div>
  );
}

function formatHistoryTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}
