import { useState } from 'react';
import { openWorkspace } from './api';
import { ConnectDialog } from './components/ConnectDialog';
import { Logo } from './components/Logo';
import { EnvironmentBadge } from './components/Status';
import { useExtensionState } from './hooks';
import { orgName } from './org';

export function SidePanelApp() {
  const { state, setState, loading } = useExtensionState();
  const [showConnect, setShowConnect] = useState(false);
  const selected = state?.orgs.find((org) => org.key === state.selectedOrgKey);

  if (loading || !state)
    return (
      <div className="app-loading">
        <span className="spinner" />
      </div>
    );
  return (
    <div className="panel-shell">
      <header className="panel-header">
        <Logo />
        <button className="icon-button" type="button" onClick={() => openWorkspace()}>
          ↗
        </button>
      </header>
      {selected ? (
        <>
          <section className="panel-org">
            <div>
              <small>Current org</small>
              <h2>{orgName(selected)}</h2>
              <p>{selected.username}</p>
            </div>
            <EnvironmentBadge org={selected} />
          </section>
          <section className="panel-section">
            <span className="eyebrow">Quick tools</span>
            <button type="button" onClick={() => openWorkspace('soql')}>
              <span>⌘</span>
              <div>
                <strong>SOQL Explorer</strong>
                <small>Run an authorized query</small>
              </div>
              <b>›</b>
            </button>
            <button type="button" onClick={() => openWorkspace('org-info')}>
              <span>◎</span>
              <div>
                <strong>Org Info</strong>
                <small>Identity and limits</small>
              </div>
              <b>›</b>
            </button>
            <button type="button" onClick={() => openWorkspace('ai')}>
              <span>✦</span>
              <div>
                <strong>AI Agent</strong>
                <small>Ask your preferred AI model</small>
              </div>
              <b>›</b>
            </button>
          </section>
          <section className="panel-callout">
            <span>✦</span>
            <div>
              <strong>Provider-direct BYOK</strong>
              <p>Keys stay in browser session storage; context requires your approval.</p>
            </div>
          </section>
          <button
            className="button button-secondary button-full"
            type="button"
            onClick={() => setShowConnect(true)}
          >
            Switch or connect org
          </button>
        </>
      ) : (
        <div className="popup-empty">
          <div className="connection-orbit">
            <span>☁</span>
          </div>
          <h1>Open Salesforce first</h1>
          <p>
            Varkole automatically uses the user session from the active signed-in Salesforce tab.
          </p>
          <button
            className="button button-primary button-full"
            type="button"
            onClick={() => setShowConnect(true)}
          >
            OAuth fallback
          </button>
        </div>
      )}
      {showConnect && (
        <ConnectDialog
          state={state}
          onClose={() => setShowConnect(false)}
          onConnected={(next) => {
            setState(next);
            setShowConnect(false);
          }}
        />
      )}
    </div>
  );
}
