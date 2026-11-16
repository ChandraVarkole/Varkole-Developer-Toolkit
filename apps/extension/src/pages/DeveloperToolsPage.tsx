import { useState } from 'react';
import type { OrgIdentity } from '@varkole/shared';
import { sendMessage } from '../api';
import { EmptyState, InlineError } from '../components/Status';
import { salesforceSetupUrl, SETUP_PATHS } from './setup-navigation';

export function DeveloperToolsPage({ org }: { org?: OrgIdentity | undefined }) {
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState<string>();

  if (!org) {
    return (
      <EmptyState
        title="Open a Salesforce org"
        description="Developer Tools works with the selected Salesforce browser session."
      />
    );
  }

  const selectedOrg = org;

  const debugModeUrl = salesforceSetupUrl(selectedOrg, SETUP_PATHS.debugMode);
  const sessionSettingsUrl = salesforceSetupUrl(selectedOrg, SETUP_PATHS.sessionSettings);
  const apexTestUrl = salesforceSetupUrl(selectedOrg, SETUP_PATHS.apexTestExecution);
  const debugLogsUrl = salesforceSetupUrl(selectedOrg, SETUP_PATHS.debugLogs);

  async function reloadWithoutCache() {
    setReloading(true);
    setError(undefined);
    try {
      await sendMessage<{ reloaded: true }>({
        type: 'RELOAD_SALESFORCE_WITHOUT_CACHE',
        payload: { key: selectedOrg.key },
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Chrome could not reload Salesforce.');
    } finally {
      setReloading(false);
    }
  }

  return (
    <div className="page-stack developer-tools-page">
      <header className="page-header">
        <div>
          <div className="eyebrow">Frontend development</div>
          <h1>Developer Tools</h1>
          <p>Reload fresh UI resources and open the Salesforce settings used by UI engineers.</p>
        </div>
      </header>

      <InlineError message={error} />

      <section className="section-card developer-tool-card">
        <div>
          <div className="tool-card-icon" aria-hidden="true">
            ↻
          </div>
          <h2>Reload without cache</h2>
          <p>
            Reloads the matching Salesforce tab while bypassing Chrome's HTTP cache for this load.
            Sign-in cookies, saved queries, and other sites are not cleared.
          </p>
        </div>
        <button
          className="button button-primary"
          type="button"
          disabled={reloading}
          onClick={() => void reloadWithoutCache()}
        >
          {reloading ? 'Reloading…' : 'Reload Salesforce'}
        </button>
      </section>

      <div className="developer-tool-grid">
        <section className="section-card developer-tool-card compact">
          <div>
            <div className="tool-card-icon" aria-hidden="true">
              &lt;/&gt;
            </div>
            <h2>Lightning Debug Mode</h2>
            <p>
              Enable Debug Mode for your user to load readable, unminified Lightning component
              JavaScript and receive more useful browser-console errors.
            </p>
          </div>
          {debugModeUrl && (
            <a
              className="button button-secondary button-compact"
              href={debugModeUrl}
              target="_blank"
              rel="noreferrer noopener"
            >
              Open Debug Mode <span aria-hidden="true">↗</span>
            </a>
          )}
        </section>

        <section className="section-card developer-tool-card compact">
          <div>
            <div className="tool-card-icon" aria-hidden="true">
              ⚡
            </div>
            <h2>Persistent browser cache</h2>
            <p>
              Admins can temporarily disable Salesforce's secure persistent browser caching while
              developing components. Re-enable it after testing for normal performance.
            </p>
          </div>
          {sessionSettingsUrl && (
            <a
              className="button button-secondary button-compact"
              href={sessionSettingsUrl}
              target="_blank"
              rel="noreferrer noopener"
            >
              Open Session Settings <span aria-hidden="true">↗</span>
            </a>
          )}
        </section>

        <section className="section-card developer-tool-card compact">
          <div>
            <div className="tool-card-icon" aria-hidden="true">
              ✓
            </div>
            <h2>Apex Test Execution</h2>
            <p>
              Open Salesforce's native test runner to select Apex tests, monitor queued runs, and
              inspect failures before reviewing coverage.
            </p>
          </div>
          {apexTestUrl && (
            <a
              className="button button-secondary button-compact"
              href={apexTestUrl}
              target="_blank"
              rel="noreferrer noopener"
            >
              Open Apex Tests <span aria-hidden="true">↗</span>
            </a>
          )}
        </section>

        <section className="section-card developer-tool-card compact">
          <div>
            <div className="tool-card-icon" aria-hidden="true">
              ≡
            </div>
            <h2>Debug Logs &amp; Trace Flags</h2>
            <p>
              Configure trace flags and inspect which users have active logging before reproducing
              an Apex, Flow, integration, or automation issue.
            </p>
          </div>
          {debugLogsUrl && (
            <a
              className="button button-secondary button-compact"
              href={debugLogsUrl}
              target="_blank"
              rel="noreferrer noopener"
            >
              Open Debug Logs <span aria-hidden="true">↗</span>
            </a>
          )}
        </section>
      </div>

      <p className="developer-tools-note">
        Varkole does not request Chrome's broad browsing-data permission and never clears cookies,
        passwords, or cache belonging to other websites.
      </p>
    </div>
  );
}
