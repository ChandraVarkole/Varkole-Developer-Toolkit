import { useEffect, useMemo, useState } from 'react';
import type { ExtensionState } from '@varkole/shared';
import { ConnectDialog } from './components/ConnectDialog';
import { Logo } from './components/Logo';
import { OrgSelector } from './components/OrgSelector';
import { EnvironmentBadge, InlineError } from './components/Status';
import { useExtensionState } from './hooks';
import { AppTabsPage } from './pages/AppTabsPage';
import { AiAgentPage } from './pages/AiAgentPage';
import { DebugLogsPage } from './pages/DebugLogsPage';
import { CoveragePage } from './pages/CoveragePage';
import { CodeInspectorPage } from './pages/CodeInspectorPage';
import { ExportPage } from './pages/ExportPage';
import { ImportPage } from './pages/ImportPage';
import { IntegrationsPage } from './pages/IntegrationsPage';
import { MetadataPage } from './pages/MetadataPage';
import { OrgInfoPage } from './pages/OrgInfoPage';
import { RecordsPage } from './pages/RecordsPage';
import { ReadOnlyQueryPage } from './pages/ReadOnlyQueryPage';
import { READ_ONLY_MODULES } from './pages/read-only-modules';
import { RunApexPage } from './pages/RunApexPage';
import { SoqlPage } from './pages/SoqlPage';
import { orgName } from './org';
import { openWorkspace } from './api';
import {
  applyThemePreference,
  DEFAULT_THEME,
  loadThemePreference,
  saveThemePreference,
  THEME_OPTIONS,
  type ThemePreference,
} from './theme';
import type {
  ComponentPickResult,
  ComponentPickResultMessage,
  PickedComponentContext,
} from './component-picker';

interface ModuleItem {
  id: string;
  label: string;
  icon: string;
  available?: boolean;
  featured?: boolean;
  group: 'Build' | 'Admin' | 'Intelligence';
}

const MODULES: ModuleItem[] = [
  { id: 'records', label: 'Record Inspector', icon: '▤', available: true, group: 'Build' },
  { id: 'soql', label: 'SOQL', icon: '⌘', available: true, group: 'Build' },
  { id: 'run-apex', label: 'Run Apex', icon: '›_', available: true, group: 'Build' },
  { id: 'code', label: 'Code Inspector', icon: '</>', available: true, group: 'Build' },
  { id: 'logs', label: 'Debug Logs', icon: '≡', available: true, group: 'Build' },
  { id: 'org-info', label: 'Org Info', icon: '◎', available: true, group: 'Build' },
  { id: 'export', label: 'Export', icon: '↓', available: true, group: 'Build' },
  { id: 'import', label: 'Import', icon: '↑', available: true, group: 'Build' },
  { id: 'coverage', label: 'Code Coverage', icon: '◔', available: true, group: 'Build' },
  { id: 'users', label: 'Users', icon: '♙', available: true, group: 'Admin' },
  { id: 'access', label: 'Access Assignments', icon: '⌾', available: true, group: 'Admin' },
  { id: 'packages', label: 'Installed Packages', icon: '⬡', available: true, group: 'Admin' },
  { id: 'flows', label: 'Flows', icon: '⇄', available: true, group: 'Admin' },
  { id: 'metadata', label: 'Schema Explorer', icon: '◇', available: true, group: 'Admin' },
  { id: 'integrations', label: 'Integrations', icon: '⇆', available: true, group: 'Admin' },
  { id: 'app-tabs', label: 'App Navigation', icon: '⊞', available: true, group: 'Admin' },
  {
    id: 'ai',
    label: 'AI Agent',
    icon: '✦',
    available: true,
    featured: true,
    group: 'Intelligence',
  },
  { id: 'settings', label: 'Settings', icon: '⚙', available: true, group: 'Intelligence' },
];

export function WorkspaceApp() {
  const searchParams = new URLSearchParams(window.location.search);
  const embedded = searchParams.get('embedded') === '1';
  const [currentRecordId, setCurrentRecordId] = useState(searchParams.get('recordId') ?? undefined);
  const [currentPageUrl, setCurrentPageUrl] = useState(searchParams.get('pageUrl') ?? undefined);
  const [pickedComponent, setPickedComponent] = useState<PickedComponentContext>();
  const [componentPickResult, setComponentPickResult] = useState<ComponentPickResult>();
  const { state, setState, error, loading } = useExtensionState();
  const [module, setModule] = useState(readHash());
  const [showConnect, setShowConnect] = useState(false);
  const [theme, setTheme] = useState<ThemePreference>(DEFAULT_THEME);
  const [themeReady, setThemeReady] = useState(false);

  useEffect(() => {
    let active = true;
    void loadThemePreference().then((preference) => {
      if (!active) return;
      setTheme(preference);
      setThemeReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    applyThemePreference(theme);
    if (themeReady) void saveThemePreference(theme);
  }, [theme, themeReady]);

  useEffect(() => {
    const update = () => setModule(readHash());
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);

  useEffect(() => {
    const receiveContext = (event: MessageEvent<unknown>) => {
      if (event.source !== window.parent) return;
      if (isPageContextMessage(event.data)) {
        const pageContextMessage = event.data;
        setCurrentRecordId(pageContextMessage.recordId);
        setCurrentPageUrl(pageContextMessage.pageUrl);
        return;
      }
      if (isComponentPickResultMessage(event.data)) {
        setComponentPickResult(event.data);
        if (event.data.status === 'found') setPickedComponent(event.data.component);
      }
    };
    window.addEventListener('message', receiveContext);
    return () => window.removeEventListener('message', receiveContext);
  }, []);

  const selectedOrg = useMemo(
    () => state?.orgs.find((org) => org.key === state.selectedOrgKey),
    [state],
  );
  const activeModule =
    MODULES.find((item) => item.id === module) ?? MODULES.find((item) => item.id === 'soql')!;

  function navigate(id: string) {
    if (id !== 'code') {
      setPickedComponent(undefined);
      setComponentPickResult(undefined);
    }
    setModule(id);
    window.history.replaceState(null, '', `#${id}`);
  }

  if (loading || !state) {
    return (
      <div className="app-loading">
        <Logo />
        <span className="spinner" />
      </div>
    );
  }

  return (
    <div className={`workspace-shell ${embedded ? 'embedded' : ''}`}>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Logo />
        </div>
        <nav aria-label="Toolkit modules">
          {(['Build', 'Admin', 'Intelligence'] as const).map((group) => (
            <div className="nav-group" key={group}>
              <span className="nav-heading">{group}</span>
              {MODULES.filter((item) => item.group === group).map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={`nav-item ${item.id === activeModule.id ? 'active' : ''} ${item.featured ? 'featured' : ''}`}
                  onClick={() => navigate(item.id)}
                >
                  <span className="nav-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                  {item.featured && <span className="ai-nav-pill">New</span>}
                  {!item.available && <span className="phase-pill">Soon</span>}
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <main className="workspace-main">
        <header className="topbar">
          <OrgSelector state={state} onChange={setState} onConnect={() => setShowConnect(true)} />
          <div className="topbar-actions">
            {currentRecordId && (
              <button
                className="current-record-button"
                type="button"
                onClick={() => navigate('records')}
                title={`Inspect Salesforce record ${currentRecordId}`}
              >
                <span>▤</span>
                <span className="current-record-label">Inspect current record</span>
              </button>
            )}
            {selectedOrg && !selectedOrg.connected && (
              <span className="session-warning">Session ended</span>
            )}
            <button className="icon-button" type="button" aria-label="Help">
              ?
            </button>
            <button className="avatar-button" type="button" aria-label="Current Salesforce user">
              {(selectedOrg?.displayName ?? 'V').slice(0, 1).toUpperCase()}
            </button>
            {embedded && (
              <button
                className="icon-button embedded-expand"
                type="button"
                onClick={() =>
                  openWorkspace(activeModule.id, {
                    recordId: currentRecordId,
                    pageUrl: currentPageUrl,
                  })
                }
                aria-label="Open full-page workspace"
                title="Open full-page workspace"
              >
                ↗
              </button>
            )}
          </div>
        </header>

        {selectedOrg?.environment === 'production' && (
          <div className="production-banner">
            <EnvironmentBadge org={selectedOrg} />
            Read-only tools are active.
          </div>
        )}

        <div className="workspace-content">
          <InlineError message={error} />
          {activeModule.id === 'records' ? (
            <RecordsPage
              key={`${selectedOrg?.key ?? 'none'}:${String(selectedOrg?.connected)}:${currentRecordId ?? 'browse'}`}
              org={selectedOrg}
              initialRecordId={currentRecordId}
            />
          ) : activeModule.id === 'soql' ? (
            <SoqlPage
              key={`${selectedOrg?.key ?? 'none'}:${String(selectedOrg?.connected)}`}
              org={selectedOrg}
            />
          ) : activeModule.id === 'export' ? (
            <ExportPage
              key={`${selectedOrg?.key ?? 'none'}:${String(selectedOrg?.connected)}`}
              org={selectedOrg}
            />
          ) : activeModule.id === 'run-apex' ? (
            <RunApexPage
              key={`${selectedOrg?.key ?? 'none'}:${String(selectedOrg?.connected)}`}
              org={selectedOrg}
            />
          ) : activeModule.id === 'code' ? (
            <CodeInspectorPage
              key={`${selectedOrg?.key ?? 'none'}:${String(selectedOrg?.connected)}:${currentRecordId ?? 'browse'}:${currentPageUrl ?? 'direct'}`}
              org={selectedOrg}
              currentRecordId={currentRecordId}
              currentPageUrl={currentPageUrl}
              embedded={embedded}
              pickedComponent={pickedComponent}
              componentPickResult={componentPickResult}
              onClearPickedComponent={() => {
                setPickedComponent(undefined);
                setComponentPickResult(undefined);
              }}
            />
          ) : activeModule.id === 'import' ? (
            <ImportPage
              key={`${selectedOrg?.key ?? 'none'}:${String(selectedOrg?.connected)}`}
              org={selectedOrg}
            />
          ) : activeModule.id === 'org-info' ? (
            <OrgInfoPage
              key={`${selectedOrg?.key ?? 'none'}:${String(selectedOrg?.connected)}`}
              org={selectedOrg}
            />
          ) : activeModule.id === 'app-tabs' ? (
            <AppTabsPage
              key={`${selectedOrg?.key ?? 'none'}:${String(selectedOrg?.connected)}`}
              org={selectedOrg}
            />
          ) : activeModule.id === 'metadata' ? (
            <MetadataPage
              key={`${selectedOrg?.key ?? 'none'}:${String(selectedOrg?.connected)}`}
              org={selectedOrg}
            />
          ) : activeModule.id === 'integrations' ? (
            <IntegrationsPage
              key={`${selectedOrg?.key ?? 'none'}:${String(selectedOrg?.connected)}`}
              org={selectedOrg}
            />
          ) : activeModule.id === 'logs' ? (
            <DebugLogsPage
              key={`${selectedOrg?.key ?? 'none'}:${String(selectedOrg?.connected)}`}
              org={selectedOrg}
            />
          ) : activeModule.id === 'coverage' ? (
            <CoveragePage
              key={`${selectedOrg?.key ?? 'none'}:${String(selectedOrg?.connected)}`}
              org={selectedOrg}
            />
          ) : activeModule.id === 'ai' ? (
            <AiAgentPage
              key={`${selectedOrg?.key ?? 'none'}:${String(selectedOrg?.connected)}`}
              org={selectedOrg}
              currentRecordId={currentRecordId}
            />
          ) : activeModule.id === 'settings' ? (
            <SettingsPage
              state={state}
              setState={setState}
              onConnect={() => setShowConnect(true)}
              theme={theme}
              onThemeChange={setTheme}
            />
          ) : READ_ONLY_MODULES[activeModule.id] ? (
            <ReadOnlyQueryPage
              key={`${selectedOrg?.key ?? 'none'}:${activeModule.id}:${String(selectedOrg?.connected)}`}
              org={selectedOrg}
              config={READ_ONLY_MODULES[activeModule.id]!}
            />
          ) : (
            <UnavailableModule module={activeModule} onNavigate={navigate} />
          )}
        </div>
      </main>

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

function UnavailableModule({
  module,
  onNavigate,
}: {
  module: ModuleItem;
  onNavigate: (id: string) => void;
}) {
  return (
    <div className="coming-soon">
      <span className="coming-icon">{module.icon}</span>
      <div className="eyebrow">Planned module</div>
      <h1>{module.label}</h1>
      <p>
        This module is intentionally unavailable in the current verified slice. It will be enabled
        only with real Salesforce API integration, permission handling, and acceptance tests.
      </p>
      <button className="button button-primary" type="button" onClick={() => onNavigate('soql')}>
        Open working SOQL
      </button>
    </div>
  );
}

function SettingsPage({
  state,
  setState,
  onConnect,
  theme,
  onThemeChange,
}: {
  state: ExtensionState;
  setState: (state: ExtensionState) => void;
  onConnect: () => void;
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
}) {
  const selectedOrg = state.orgs.find((org) => org.key === state.selectedOrgKey);

  async function disconnect(key: string) {
    const { sendMessage } = await import('./api');
    setState(await sendMessage<ExtensionState>({ type: 'DISCONNECT_ORG', payload: { key } }));
  }

  async function copyDiagnostics() {
    const diagnostics = {
      extension: `Varkole Developer Toolkit ${chrome.runtime.getManifest().version}`,
      orgId: selectedOrg?.orgId ?? 'none',
      instanceHost: selectedOrg ? new URL(selectedOrg.instanceUrl).hostname : 'none',
      apiVersion: selectedOrg?.apiVersion ?? 'none',
      environment: selectedOrg?.environment ?? 'none',
      connectionSource: selectedOrg?.connectionSource ?? 'none',
      connected: selectedOrg?.connected ?? false,
      generatedAt: new Date().toISOString(),
    };
    await navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2));
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <div className="eyebrow">Local preferences</div>
          <h1>Settings</h1>
          <p>Manage secure Salesforce sessions and extension configuration.</p>
        </div>
        <button className="button button-primary" type="button" onClick={onConnect}>
          OAuth fallback
        </button>
      </header>
      <section className="section-card theme-settings">
        <div className="section-title">
          <div>
            <h2>Appearance</h2>
            <p>Choose a toolkit color. Your preference stays in this browser.</p>
          </div>
        </div>
        <div className="theme-options" role="radiogroup" aria-label="Toolkit theme">
          {THEME_OPTIONS.map((option) => (
            <button
              className={`theme-option ${theme.id === option.id ? 'selected' : ''}`}
              key={option.id}
              type="button"
              role="radio"
              aria-checked={theme.id === option.id}
              onClick={() => onThemeChange({ ...theme, id: option.id })}
            >
              <span
                className="theme-swatch"
                style={{
                  background: `linear-gradient(135deg, ${option.color}, ${option.secondary})`,
                }}
              />
              <span>{option.label}</span>
            </button>
          ))}
          <label className={`theme-option custom ${theme.id === 'custom' ? 'selected' : ''}`}>
            <input
              type="color"
              value={theme.customColor}
              aria-label="Custom theme color"
              onChange={(event) => onThemeChange({ id: 'custom', customColor: event.target.value })}
            />
            <span>Custom</span>
          </label>
        </div>
      </section>
      <section className="section-card">
        <div className="section-title">
          <div>
            <h2>Org connections</h2>
            <p>
              Browser sessions are read live from Salesforce cookies; OAuth fallback tokens remain
              in session storage.
            </p>
          </div>
        </div>
        <div className="connection-list">
          {state.orgs.length === 0 && <p className="muted">No connected orgs yet.</p>}
          {state.orgs.map((org) => (
            <div className="connection-row" key={org.key}>
              <span className={`org-avatar ${org.environment}`}>{orgName(org).slice(0, 1)}</span>
              <div>
                <strong>{orgName(org)}</strong>
                <span>
                  {org.username} · {org.orgId}
                </span>
              </div>
              <span className={`connection-state ${org.connected ? 'online' : ''}`}>
                {org.connected ? 'Connected' : 'Reconnect'}
              </span>
              <button
                className="button button-ghost danger-text"
                type="button"
                onClick={() => void disconnect(org.key)}
              >
                Disconnect
              </button>
            </div>
          ))}
        </div>
      </section>
      <section className="section-card compact-section">
        <div>
          <h2>OAuth redirect URL</h2>
          <p className="muted">Register this exact value in the Salesforce External Client App.</p>
        </div>
        <code className="copy-code">{state.redirectUrl}</code>
      </section>
      <section className="section-card developer-diagnostics">
        <div className="section-title">
          <div>
            <h2>Developer diagnostics</h2>
            <p>
              Safe request context only—session IDs, query results, and record data are never
              included.
            </p>
          </div>
          <button
            className="button button-secondary"
            type="button"
            onClick={() => void copyDiagnostics()}
          >
            Copy diagnostics
          </button>
        </div>
        <div className="diagnostic-grid">
          <DiagnosticDetail label="Extension" value={chrome.runtime.getManifest().version} />
          <DiagnosticDetail
            label="API version"
            value={selectedOrg ? `v${selectedOrg.apiVersion}` : 'No org'}
          />
          <DiagnosticDetail
            label="Instance host"
            value={selectedOrg ? new URL(selectedOrg.instanceUrl).hostname : 'No org'}
          />
        </div>
        <div className="devtools-guide">
          <strong>Console, Sources & Network</strong>
          <p>
            Right-click inside Varkole and choose <b>Inspect</b>. Source maps are included in this
            developer build. In Network, filter for <code>services/data</code>; API usage, elapsed
            time, mode, and hostname also appear beside every result grid.
          </p>
        </div>
      </section>
    </div>
  );
}

function DiagnosticDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail">
      <span>{label}</span>
      <strong className="mono">{value}</strong>
    </div>
  );
}

function readHash() {
  return location.hash.replace(/^#/, '') || 'records';
}

function isPageContextMessage(value: unknown): value is {
  type: 'VARKOLE_PAGE_CONTEXT';
  recordId?: string | undefined;
  pageUrl?: string | undefined;
} {
  if (!value || typeof value !== 'object') return false;
  const message = value as { type?: unknown; recordId?: unknown; pageUrl?: unknown };
  return (
    message.type === 'VARKOLE_PAGE_CONTEXT' &&
    (message.recordId === undefined ||
      (typeof message.recordId === 'string' &&
        /^[A-Za-z0-9]{15}(?:[A-Za-z0-9]{3})?$/.test(message.recordId))) &&
    (message.pageUrl === undefined ||
      (typeof message.pageUrl === 'string' &&
        message.pageUrl.length <= 8_192 &&
        /^https?:\/\//.test(message.pageUrl)))
  );
}

function isComponentPickResultMessage(value: unknown): value is ComponentPickResultMessage {
  if (!value || typeof value !== 'object') return false;
  const message = value as {
    type?: unknown;
    status?: unknown;
    message?: unknown;
    component?: unknown;
  };
  if (message.type !== 'VARKOLE_COMPONENT_PICK_RESULT') return false;
  if (message.status === 'cancelled' || message.status === 'not-found') {
    return typeof message.message === 'string' && message.message.length <= 500;
  }
  if (message.status !== 'found' || !message.component || typeof message.component !== 'object') {
    return false;
  }
  const component = message.component as Record<string, unknown>;
  return (
    typeof component.componentName === 'string' &&
    /^[A-Za-z][A-Za-z0-9_]{0,159}$/.test(component.componentName) &&
    (component.kindHint === 'lwc' ||
      component.kindHint === 'aura' ||
      component.kindHint === 'unknown') &&
    (component.namespace === undefined ||
      (typeof component.namespace === 'string' &&
        /^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(component.namespace))) &&
    (component.tagName === undefined ||
      (typeof component.tagName === 'string' && component.tagName.length <= 240)) &&
    (component.descriptor === undefined ||
      (typeof component.descriptor === 'string' && component.descriptor.length <= 240)) &&
    (component.metadataType === undefined ||
      component.metadataType === 'QuickAction' ||
      component.metadataType === 'CustomTab' ||
      component.metadataType === 'Flow') &&
    (component.metadataName === undefined ||
      (typeof component.metadataName === 'string' &&
        /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)?$/.test(component.metadataName)))
  );
}
