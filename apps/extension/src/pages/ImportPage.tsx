import { useState } from 'react';
import type { OrgIdentity, QueryPage } from '@varkole/shared';
import { ObjectFieldPicker } from '../components/ObjectFieldPicker';
import { QueryResults } from '../components/QueryResults';
import { EmptyState, InlineError } from '../components/Status';
import { parseCsv } from './csv-parser';

export function ImportPage({ org }: { org?: OrgIdentity | undefined }) {
  const [objectApiName, setObjectApiName] = useState('');
  const [targetFields, setTargetFields] = useState<string[]>([]);
  const [csv, setCsv] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [result, setResult] = useState<QueryPage>();
  const [error, setError] = useState<string>();

  function analyze() {
    setError(undefined);
    try {
      const parsed = parseCsv(csv);
      setHeaders(parsed.headers);
      setResult({
        totalSize: parsed.rows.length,
        done: true,
        records: parsed.rows.slice(0, 200),
        elapsedMs: 0,
      });
    } catch (cause) {
      setHeaders([]);
      setResult(undefined);
      setError(cause instanceof Error ? cause.message : 'CSV could not be parsed.');
    }
  }

  if (!org) {
    return (
      <EmptyState
        title="Open a Salesforce org"
        description="Import preflight uses metadata from the selected org."
      />
    );
  }

  const unmapped = headers.filter((header) => !targetFields.includes(header));

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <div className="eyebrow">Local-only preflight</div>
          <h1>Import Preview</h1>
        </div>
      </header>
      <section className="section-card">
        <ObjectFieldPicker
          org={org}
          objectApiName={objectApiName}
          onObjectApiNameChange={setObjectApiName}
          selectedFields={targetFields}
          onSelectedFieldsChange={setTargetFields}
        />
        <textarea
          className="csv-editor"
          value={csv}
          onChange={(event) => setCsv(event.target.value)}
          spellCheck={false}
          aria-label="CSV import content"
          placeholder="Paste CSV data here"
        />
        <div className="section-actions">
          <span className="muted">Local preview · 200 rows maximum.</span>
          <button
            className="button button-primary"
            type="button"
            disabled={!csv.trim()}
            onClick={analyze}
          >
            {result ? 'Analyze again' : 'Analyze CSV'}
          </button>
        </div>
      </section>
      <InlineError message={error} />
      {headers.length > 0 && (
        <section className={`mapping-status ${unmapped.length ? 'warning' : 'success'}`}>
          <strong>
            {unmapped.length ? 'Mapping needs attention' : 'Headers match selected fields'}
          </strong>
          <p>
            {unmapped.length
              ? `Select fields for: ${unmapped.join(', ')}`
              : `${headers.length} CSV columns are selected.`}
          </p>
        </section>
      )}
      {result && (
        <QueryResults result={result} pageNumber={1} modeLabel="Local preview" loading={false} />
      )}
    </div>
  );
}
