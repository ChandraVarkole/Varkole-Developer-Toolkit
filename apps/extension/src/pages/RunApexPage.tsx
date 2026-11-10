import { useState } from 'react';
import type { ExecuteAnonymousResult, OrgIdentity } from '@varkole/shared';
import { sendMessage } from '../api';
import { EmptyState, InlineError } from '../components/Status';

const DEFAULT_APEX = "System.debug('Varkole Developer Toolkit');";

export function RunApexPage({ org }: { org?: OrgIdentity | undefined }) {
  const [apex, setApex] = useState(DEFAULT_APEX);
  const [acknowledged, setAcknowledged] = useState(false);
  const [productionText, setProductionText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<ExecuteAnonymousResult>();

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
    setLoading(true);
    setError(undefined);
    setResult(undefined);
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
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Salesforce could not execute Apex.');
    } finally {
      setLoading(false);
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
        <>
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
          <p className="apex-log-note">
            Go to the <a href="#logs">Debug Logs</a> tab to view the latest logs if debug logging is
            enabled for your user.
          </p>
        </>
      )}
    </div>
  );
}
