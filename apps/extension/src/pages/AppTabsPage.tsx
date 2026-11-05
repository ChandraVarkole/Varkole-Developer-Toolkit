import { useState } from 'react';
import type { OrgIdentity, QueryPage, SalesforceTabInfo } from '@varkole/shared';
import { sendMessage } from '../api';
import { QueryResults } from '../components/QueryResults';
import { EmptyState, InlineError } from '../components/Status';
import { useAutoLoad } from '../useAutoLoad';

export function AppTabsPage({ org }: { org?: OrgIdentity | undefined }) {
  const [result, setResult] = useState<QueryPage>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!org) return;
    setLoading(true);
    setError(undefined);
    const started = performance.now();
    try {
      const tabs = await sendMessage<SalesforceTabInfo[]>({
        type: 'GET_TABS',
        payload: { key: org.key },
      });
      setResult({
        totalSize: tabs.length,
        done: true,
        records: tabs.map((tab) => ({
          Tab: tab.label,
          Type: tab.custom ? 'Custom' : 'Standard',
        })),
        elapsedMs: Math.round(performance.now() - started),
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Salesforce could not load tabs.');
    } finally {
      setLoading(false);
    }
  }

  useAutoLoad(load, org?.key);

  if (!org) {
    return (
      <EmptyState
        title="Open a Salesforce org"
        description="Available tabs are read from the selected org."
      />
    );
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <div className="eyebrow">Navigation · read-only</div>
          <h1>App Tabs</h1>
        </div>
        <button
          className="button button-primary"
          type="button"
          disabled={loading}
          onClick={() => void load()}
        >
          {loading ? 'Loading…' : result ? 'Refresh tabs' : 'Load tabs'}
        </button>
      </header>
      <InlineError message={error} />
      {result && (
        <QueryResults result={result} pageNumber={1} modeLabel="REST Tabs" loading={loading} />
      )}
    </div>
  );
}
