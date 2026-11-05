import { useState } from 'react';
import type { OrgIdentity, QueryPage } from '@varkole/shared';
import { sendMessage } from '../api';
import { ObjectFieldPicker } from '../components/ObjectFieldPicker';
import { QueryResults } from '../components/QueryResults';
import { EmptyState, InlineError } from '../components/Status';
import { recordsToCsv, recordsToJson } from './export-utils';

export function ExportPage({ org }: { org?: OrgIdentity | undefined }) {
  const [objectApiName, setObjectApiName] = useState('');
  const [fields, setFields] = useState<string[]>([]);
  const [soql, setSoql] = useState('');
  const [result, setResult] = useState<QueryPage>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);

  async function run() {
    if (!org || !soql.trim()) return;
    setLoading(true);
    setError(undefined);
    setPageNumber(1);
    try {
      setResult(
        await sendMessage<QueryPage>({
          type: 'RUN_QUERY',
          payload: { key: org.key, soql, mode: 'rest', requestId: crypto.randomUUID() },
        }),
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Salesforce could not run the export query.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (!org || !result?.nextRecordsUrl || result.records.length >= 5000) return;
    setLoading(true);
    setError(undefined);
    try {
      const next = await sendMessage<QueryPage>({
        type: 'QUERY_NEXT',
        payload: {
          key: org.key,
          nextRecordsUrl: result.nextRecordsUrl,
          requestId: crypto.randomUUID(),
        },
      });
      setResult({
        ...next,
        records: [...result.records, ...next.records],
        elapsedMs: result.elapsedMs + next.elapsedMs,
      });
      setPageNumber((page) => page + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Salesforce could not load more rows.');
    } finally {
      setLoading(false);
    }
  }

  function download(format: 'csv' | 'json') {
    if (!result) return;
    const body = format === 'csv' ? recordsToCsv(result.records) : recordsToJson(result.records);
    const blob = new Blob([body], {
      type: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `varkole-${objectApiName.toLowerCase() || 'export'}-${new Date().toISOString().slice(0, 10)}.${format}`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (!org) {
    return (
      <EmptyState
        title="Open a Salesforce org"
        description="Exports run locally against the selected Salesforce org."
      />
    );
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <div className="eyebrow">Local export</div>
          <h1>Export</h1>
        </div>
      </header>
      <section className="section-card">
        <ObjectFieldPicker
          org={org}
          objectApiName={objectApiName}
          onObjectApiNameChange={setObjectApiName}
          selectedFields={fields}
          onSelectedFieldsChange={setFields}
        />
        <div className="section-actions">
          <span />
          <button
            className="button button-secondary"
            type="button"
            disabled={!objectApiName || !fields.length}
            onClick={() => setSoql(`SELECT ${fields.join(', ')}\nFROM ${objectApiName}\nLIMIT 200`)}
          >
            Build export query
          </button>
        </div>
        <textarea
          className="compact-code-editor"
          value={soql}
          onChange={(event) => setSoql(event.target.value)}
          spellCheck={false}
          aria-label="Export SOQL query"
          placeholder="Build or enter a SOQL query"
        />
        <div className="section-actions">
          <span className="muted">Up to 5,000 loaded rows.</span>
          <button
            className="button button-primary"
            type="button"
            disabled={loading || !soql.trim()}
            onClick={() => void run()}
          >
            {loading ? 'Loading…' : result ? 'Refresh preview' : 'Preview export'}
          </button>
        </div>
      </section>
      <InlineError message={error} />
      {result && (
        <>
          <section className="export-actions">
            <strong>{result.records.length.toLocaleString()} rows loaded</strong>
            <div>
              <button
                className="button button-secondary"
                type="button"
                onClick={() => download('csv')}
              >
                Download CSV
              </button>
              <button
                className="button button-secondary"
                type="button"
                onClick={() => download('json')}
              >
                Download JSON
              </button>
            </div>
          </section>
          <QueryResults
            result={result}
            pageNumber={pageNumber}
            modeLabel="REST Export"
            loading={loading}
            onNext={result.records.length < 5000 ? () => void loadMore() : undefined}
            recordBaseUrl={org.instanceUrl}
          />
        </>
      )}
    </div>
  );
}
