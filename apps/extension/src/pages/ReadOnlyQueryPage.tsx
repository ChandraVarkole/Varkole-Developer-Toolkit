import { useState } from 'react';
import type { ApiMode, OrgIdentity, QueryPage } from '@varkole/shared';
import { sendMessage } from '../api';
import { QueryResults } from '../components/QueryResults';
import { EmptyState, InlineError } from '../components/Status';
import { useAutoLoad } from '../useAutoLoad';

export interface ReadOnlyQueryConfig {
  title: string;
  eyebrow: string;
  description?: string | undefined;
  query: string;
  mode: ApiMode;
  actionLabel: string;
  transformResult?: ((result: QueryPage) => QueryPage) | undefined;
  columnLabels?: Record<string, string> | undefined;
  guidance?:
    | {
        title: string;
        description: string;
      }
    | undefined;
}

export function ReadOnlyQueryPage({
  org,
  config,
}: {
  org?: OrgIdentity | undefined;
  config: ReadOnlyQueryConfig;
}) {
  const [result, setResult] = useState<QueryPage>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);

  async function run() {
    if (!org) return;
    const id = crypto.randomUUID();
    setLoading(true);
    setError(undefined);
    setPageNumber(1);
    try {
      const next = await sendMessage<QueryPage>({
        type: 'RUN_QUERY',
        payload: { key: org.key, soql: config.query, mode: config.mode, requestId: id },
      });
      setResult(config.transformResult ? config.transformResult(next) : next);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Salesforce could not complete the request.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function nextPage() {
    if (!org || !result?.nextRecordsUrl) return;
    const id = crypto.randomUUID();
    setLoading(true);
    setError(undefined);
    try {
      const next = await sendMessage<QueryPage>({
        type: 'QUERY_NEXT',
        payload: {
          key: org.key,
          nextRecordsUrl: result.nextRecordsUrl,
          requestId: id,
          mode: config.mode,
        },
      });
      setResult(config.transformResult ? config.transformResult(next) : next);
      setPageNumber((page) => page + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Salesforce could not load the next page.');
    } finally {
      setLoading(false);
    }
  }

  useAutoLoad(run, org ? `${org.key}:${config.title}` : undefined);

  if (!org) {
    return (
      <EmptyState
        title="Open a Salesforce org"
        description="This utility uses the selected Salesforce browser session."
      />
    );
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <div className="eyebrow">{config.eyebrow}</div>
          <h1>{config.title}</h1>
          {config.description && <p>{config.description}</p>}
        </div>
        <button
          className="button button-primary"
          type="button"
          disabled={loading}
          onClick={() => void run()}
        >
          {loading ? 'Loading…' : result ? 'Refresh' : config.actionLabel}
        </button>
      </header>

      {config.guidance && (
        <section className="section-card compact-section module-guidance" role="note">
          <div>
            <h2>{config.guidance.title}</h2>
            <p>{config.guidance.description}</p>
          </div>
        </section>
      )}

      <InlineError message={error} />
      {result && (
        <QueryResults
          result={result}
          pageNumber={pageNumber}
          modeLabel={config.mode === 'tooling' ? 'Tooling' : 'REST'}
          loading={loading}
          onNext={() => void nextPage()}
          recordBaseUrl={org.instanceUrl}
          columnLabels={config.columnLabels}
        />
      )}
    </div>
  );
}
