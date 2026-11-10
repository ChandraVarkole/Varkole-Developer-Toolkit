import { useState } from 'react';
import type { OrgIdentity, SalesforceTabInfo } from '@varkole/shared';
import { sendMessage } from '../api';
import { EmptyState, InlineError } from '../components/Status';
import { useAutoLoad } from '../useAutoLoad';
import { salesforceTabUrl } from './app-tab-url';

export function AppTabsPage({ org }: { org?: OrgIdentity | undefined }) {
  const [tabs, setTabs] = useState<SalesforceTabInfo[]>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!org) return;
    setLoading(true);
    setError(undefined);
    try {
      const next = await sendMessage<SalesforceTabInfo[]>({
        type: 'GET_TABS',
        payload: { key: org.key },
      });
      setTabs(
        [...next].sort((left, right) =>
          left.label.localeCompare(right.label, undefined, { sensitivity: 'base', numeric: true }),
        ),
      );
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
          {loading ? 'Loading…' : tabs ? 'Refresh tabs' : 'Load tabs'}
        </button>
      </header>
      <InlineError message={error} />
      {tabs && tabs.length === 0 && (
        <EmptyState
          title="No tabs available"
          description="Salesforce returned no accessible tabs."
        />
      )}
      {tabs && tabs.length > 0 && (
        <section className="section-card app-tabs-card">
          <div className="app-tabs-grid" aria-label="Salesforce app navigation tabs">
            {tabs.map((tab, index) => {
              const href = salesforceTabUrl(org, tab);
              return (
                <div
                  className="app-tab-row"
                  key={`${tab.name ?? tab.sobjectName ?? tab.label}-${index}`}
                >
                  <div>
                    <strong>{tab.label}</strong>
                    <span>{tab.custom ? 'Custom tab' : 'Standard tab'}</span>
                  </div>
                  {href ? (
                    <a
                      className="button button-secondary"
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open tab <span aria-hidden="true">↗</span>
                    </a>
                  ) : (
                    <span className="muted">No navigation URL</span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
