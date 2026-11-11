import { useState } from 'react';
import { ConnectDialog } from './components/ConnectDialog';
import { Logo } from './components/Logo';
import { EnvironmentBadge, InlineError } from './components/Status';
import { useExtensionState } from './hooks';
import { openWorkspace } from './api';
import { orgName } from './org';

export function PopupApp() {
  const { state, setState, error, loading } = useExtensionState();
  const [showConnect, setShowConnect] = useState(false);
  const selected = state?.orgs.find((org) => org.key === state.selectedOrgKey);

  return (
    <div className="popup-shell">
      <header className="popup-header">
        <Logo />
        <button
          className="icon-button"
          type="button"
          onClick={() => openWorkspace('ai')}
          aria-label="AI Agent setup"
        >
          ⚙
        </button>
      </header>
      <InlineError message={error} />
      {loading || !state ? (
        <div className="popup-loading">
          <span className="spinner" /> Loading…
        </div>
      ) : selected ? (
        <>
          <button className="popup-org" type="button" onClick={() => setShowConnect(true)}>
            <span className={`org-avatar ${selected.environment}`}>
              {orgName(selected).slice(0, 1)}
            </span>
            <span>
              <small>Current org</small>
              <strong>{orgName(selected)}</strong>
              <em>{selected.username}</em>
            </span>
            <EnvironmentBadge org={selected} />
          </button>
          {selected.connectionSource === 'browser-session' && (
            <p className="session-source">Using the current Salesforce browser session</p>
          )}
          {!selected.connected && (
            <div className="alert alert-warning">
              <span>i</span>
              <div>
                <strong>Reconnect required</strong>
                <p>Start a fresh secure Salesforce session.</p>
              </div>
            </div>
          )}
          <div className="quick-grid">
            <button type="button" onClick={() => openWorkspace('soql')}>
              <span>⌘</span>
              <strong>Run SOQL</strong>
              <small>Query data</small>
            </button>
            <button type="button" onClick={() => openWorkspace('org-info')}>
              <span>◎</span>
              <strong>Org Info</strong>
              <small>Limits & identity</small>
            </button>
          </div>
          <button
            className="button button-primary button-full"
            type="button"
            onClick={() => openWorkspace('records')}
          >
            Open workspace <span>→</span>
          </button>
        </>
      ) : (
        <div className="popup-empty">
          <div className="connection-orbit">
            <span>☁</span>
          </div>
          <h1>Your Salesforce toolkit</h1>
          <p>
            Open a Salesforce tab where you are already signed in, then click Varkole again. No
            separate login is needed.
          </p>
          <button
            className="button button-secondary button-full"
            type="button"
            onClick={() => setShowConnect(true)}
          >
            OAuth fallback
          </button>
          <small>Uses the current user’s Salesforce access</small>
        </div>
      )}
      {state && showConnect && (
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
