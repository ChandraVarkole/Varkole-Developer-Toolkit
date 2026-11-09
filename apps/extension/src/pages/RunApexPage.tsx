import { useState } from 'react';
import type { ExecuteAnonymousResult, OrgIdentity, QueryPage, QueryRecord } from '@varkole/shared';
import { sendMessage } from '../api';
import { EmptyState, InlineError } from '../components/Status';
import { buildExecutionLogQuery } from './apex-log';

const DEFAULT_APEX = "System.debug('Varkole Developer Toolkit');";

export function RunApexPage({ org }: { org?: OrgIdentity | undefined }) {
  const [apex, setApex] = useState(DEFAULT_APEX);
  const [acknowledged, setAcknowledged] = useState(false);
  const [productionText, setProductionText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<ExecuteAnonymousResult>();
  const [executionLog, setExecutionLog] = useState<QueryRecord>();
  const [logBody, setLogBody] = useState('');
  const [logLoading, setLogLoading] = useState(false);
  const [logError, setLogError] = useState<string>();
  const [logSearch, setLogSearch] = useState('');

  if (!org) {
    return (
      <EmptyState
        title="Open a Salesforce org"
        description="Anonymous Apex runs as the selected Salesforce user."
      />
    );
  }

  const productionConfirmed =
    org.environment !== 'production' || productionText === 'RUN IN PRODUCTION';
  const canRun = Boolean(apex.trim()) && acknowledged && productionConfirmed && !loading;

  async function run() {
    if (!org || !canRun) return;
    const startedAt = Date.now();
    setLoading(true);
    setError(undefined);
    setResult(undefined);
    setExecutionLog(undefined);
    setLogBody('');
    setLogError(undefined);
    setLogSearch('');
    try {
      const next = await sendMessage<ExecuteAnonymousResult>({
        type: 'RUN_APEX',
        payload: {
          key: org.key,
          apex,
          requestId: crypto.randomUUID(),
          confirmedProduction: productionConfirmed,
        },
      });
      setResult(next);
      void loadExecutionLog(startedAt);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Salesforce could not execute Apex.');
    } finally {
      setLoading(false);
    }
  }

  async function loadExecutionLog(startedAt: number) {
    if (!org) return;
    setLogLoading(true);
    setLogError(undefined);
    try {
      const query = buildExecutionLogQuery(org.userId, startedAt);
      for (let attempt = 0; attempt < 4; attempt += 1) {
        if (attempt) await delay(650 * attempt);
        const page = await sendMessage<QueryPage>({
          type: 'RUN_QUERY',
          payload: {
            key: org.key,
            soql: query,
            mode: 'tooling',
            requestId: crypto.randomUUID(),
          },
        });
        const record = page.records[0];
        const logId = typeof record?.Id === 'string' ? record.Id : undefined;
        if (!record || !logId) continue;
        setExecutionLog(record);
        setLogBody(
          await sendMessage<string>({
            type: 'GET_APEX_LOG_BODY',
            payload: { key: org.key, logId },
          }),
        );
        return;
      }
      setLogError(
        'No debug log was created. Enable a trace flag for your user in Setup → Debug Logs, then run Apex again.',
      );
    } catch (cause) {
      setLogError(
        cause instanceof Error
          ? cause.message
          : 'Salesforce could not load the execution debug log.',
      );
    } finally {
      setLogLoading(false);
    }
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <div className="eyebrow">Tooling API · privileged action</div>
          <h1>Run Anonymous Apex</h1>
          <p>
            Apex can modify data and invoke business logic. Varkole never runs it automatically.
          </p>
        </div>
      </header>

      <section className="query-card">
        <div className="editor-bar">
          <span>anonymous.apex</span>
          <span>Explicit click required</span>
        </div>
        <textarea
          className="query-editor apex-editor"
          value={apex}
          onChange={(event) => setApex(event.target.value)}
          spellCheck={false}
          aria-label="Anonymous Apex code"
        />
      </section>

      <section
        className={`apex-confirmation ${org.environment === 'production' ? 'production' : ''}`}
      >
        <strong>
          {org.environment === 'production'
            ? 'Production execution guard'
            : 'Execution confirmation'}
        </strong>
        <label className="confirmation-check">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
          />
          <span>I understand this Apex can create, update, or delete Salesforce data.</span>
        </label>
        {org.environment === 'production' && (
          <label>
            <span>Type RUN IN PRODUCTION</span>
            <input
              value={productionText}
              onChange={(event) => setProductionText(event.target.value)}
              autoComplete="off"
            />
          </label>
        )}
        <button
          className="button button-primary"
          type="button"
          disabled={!canRun}
          onClick={() => void run()}
        >
          {loading ? 'Executing…' : 'Execute Apex'}
        </button>
      </section>

      <InlineError message={error} />
      {result && (
        <section className={`apex-result ${result.success ? 'success' : 'failure'}`}>
          <h2>
            {result.success
              ? 'Execution succeeded'
              : result.compiled
                ? 'Runtime failure'
                : 'Compile failure'}
          </h2>
          <dl>
            <div>
              <dt>Compiled</dt>
              <dd>{String(result.compiled)}</dd>
            </div>
            <div>
              <dt>Success</dt>
              <dd>{String(result.success)}</dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>
                Line {result.line}, column {result.column}
              </dd>
            </div>
          </dl>
          {(result.compileProblem || result.exceptionMessage || result.exceptionStackTrace) && (
            <pre>
              {result.compileProblem ?? result.exceptionMessage ?? result.exceptionStackTrace}
            </pre>
          )}
        </section>
      )}

      {(result || logLoading || logError) && (
        <section className="section-card apex-log-card">
          <div className="section-title">
            <div>
              <h2>Execution debug log</h2>
              <p>The newest log created for this execution is displayed here.</p>
            </div>
            {executionLog && (
              <div className="apex-log-meta">
                <span>{formatScalar(executionLog.Status) || 'Unknown status'}</span>
                <span>{formatDuration(executionLog.DurationMilliseconds)}</span>
                <span>{formatBytes(executionLog.LogLength)}</span>
              </div>
            )}
          </div>
          {logLoading ? (
            <p className="muted">Waiting for Salesforce to publish the debug log…</p>
          ) : logError ? (
            <InlineError message={logError} />
          ) : logBody ? (
            <>
              <input
                className="apex-log-search"
                value={logSearch}
                onChange={(event) => setLogSearch(event.target.value)}
                placeholder="Find text in this log…"
              />
              <pre className="apex-log-body">{highlightLog(logBody, logSearch)}</pre>
            </>
          ) : null}
        </section>
      )}
    </div>
  );
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function formatDuration(value: unknown): string {
  return typeof value === 'number' ? `${value.toLocaleString()} ms` : 'Duration unavailable';
}

function formatScalar(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  return '';
}

function formatBytes(value: unknown): string {
  if (typeof value !== 'number') return 'Size unavailable';
  return value >= 1_024 ? `${(value / 1_024).toFixed(1)} KB` : `${value} B`;
}

function highlightLog(body: string, search: string) {
  const term = search.trim();
  if (!term) return body;
  const parts = body.split(new RegExp(`(${escapeRegExp(term)})`, 'gi'));
  return parts.map((part, index) =>
    part.toLowerCase() === term.toLowerCase() ? <mark key={index}>{part}</mark> : part,
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
