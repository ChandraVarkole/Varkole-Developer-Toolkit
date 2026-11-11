import { useState } from 'react';
import type { ApiMode, MetadataFileProperty, OrgIdentity, QueryPage } from '@varkole/shared';
import { sendMessage } from '../api';
import { QueryResults } from '../components/QueryResults';
import { EmptyState, InlineError } from '../components/Status';
import { useAutoLoad } from '../useAutoLoad';
import { packageStateLabel } from './setup-inventory';

interface IntegrationQueryConfig {
  id: string;
  title: string;
  description: string;
  mode: ApiMode;
  query: string;
  columnLabels: Record<string, string>;
}

const INTEGRATION_QUERIES: IntegrationQueryConfig[] = [
  {
    id: 'connected-apps',
    title: 'Connected Apps',
    description: 'OAuth applications registered in this org.',
    mode: 'rest',
    query:
      'SELECT Name, OptionsAllowAdminApprovedUsersOnly, OptionsHasSessionLevelPolicy, OptionsIsInternal, LastModifiedDate FROM ConnectedApplication ORDER BY Name',
    columnLabels: {
      Name: 'Application',
      OptionsAllowAdminApprovedUsersOnly: 'Admin approved users only',
      OptionsHasSessionLevelPolicy: 'Session policy',
      OptionsIsInternal: 'Salesforce internal',
      LastModifiedDate: 'Last modified',
    },
  },
  {
    id: 'named-credentials',
    title: 'Named Credentials',
    description: 'Callout endpoints and authentication configuration. Secrets are never read.',
    mode: 'tooling',
    query:
      'SELECT MasterLabel, DeveloperName, NamespacePrefix, Endpoint, PrincipalType, CalloutOptionsGenerateAuthorizationHeader FROM NamedCredential ORDER BY MasterLabel',
    columnLabels: {
      MasterLabel: 'Named credential',
      DeveloperName: 'API name',
      NamespacePrefix: 'Namespace prefix',
      Endpoint: 'Endpoint',
      PrincipalType: 'Principal type',
      CalloutOptionsGenerateAuthorizationHeader: 'Generates authorization header',
    },
  },
  {
    id: 'external-credentials',
    title: 'External Credentials',
    description:
      'Authentication protocols and package ownership. Principal secrets are never read.',
    mode: 'tooling',
    query:
      'SELECT MasterLabel, DeveloperName, NamespacePrefix, AuthenticationProtocol, ManageableState FROM ExternalCredential ORDER BY MasterLabel',
    columnLabels: {
      MasterLabel: 'External credential',
      DeveloperName: 'API name',
      NamespacePrefix: 'Namespace prefix',
      AuthenticationProtocol: 'Authentication protocol',
      ManageableState: 'Manageable state',
    },
  },
];

export function IntegrationsPage({ org }: { org?: OrgIdentity | undefined }) {
  if (!org) {
    return (
      <EmptyState
        title="Open a Salesforce org"
        description="Integration inventory uses the selected Salesforce browser session."
      />
    );
  }

  return (
    <div className="page-stack integrations-page">
      <header className="page-header">
        <div>
          <div className="eyebrow">Integration inventory · read-only</div>
          <h1>Integrations</h1>
          <p>
            Configuration visible to your current Salesforce user. Credential secrets are excluded.
          </p>
        </div>
      </header>

      {INTEGRATION_QUERIES.map((config) => (
        <IntegrationQuerySection key={config.id} org={org} config={config} />
      ))}
      <ExternalClientAppsSection org={org} />
    </div>
  );
}

function IntegrationQuerySection({
  org,
  config,
}: {
  org: OrgIdentity;
  config: IntegrationQueryConfig;
}) {
  const [result, setResult] = useState<QueryPage>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);

  async function load() {
    const requestId = crypto.randomUUID();
    setLoading(true);
    setError(undefined);
    setPageNumber(1);
    try {
      setResult(
        await sendMessage<QueryPage>({
          type: 'RUN_QUERY',
          payload: { key: org.key, soql: config.query, mode: config.mode, requestId },
        }),
      );
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }

  async function loadNext() {
    if (!result?.nextRecordsUrl) return;
    const requestId = crypto.randomUUID();
    setLoading(true);
    setError(undefined);
    try {
      setResult(
        await sendMessage<QueryPage>({
          type: 'QUERY_NEXT',
          payload: {
            key: org.key,
            nextRecordsUrl: result.nextRecordsUrl,
            requestId,
            mode: config.mode,
          },
        }),
      );
      setPageNumber((current) => current + 1);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }

  useAutoLoad(load, `${org.key}:${config.id}`);

  return (
    <section className="inventory-section" aria-labelledby={`${config.id}-title`}>
      <div className="inventory-section-heading">
        <div>
          <h2 id={`${config.id}-title`}>{config.title}</h2>
          <p>{config.description}</p>
        </div>
        <button
          className="button button-secondary"
          type="button"
          disabled={loading}
          onClick={() => void load()}
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>
      <InlineError message={error} />
      {result && (
        <QueryResults
          result={result}
          pageNumber={pageNumber}
          modeLabel={config.mode === 'tooling' ? 'Tooling' : 'REST'}
          loading={loading}
          onNext={() => void loadNext()}
          columnLabels={config.columnLabels}
        />
      )}
    </section>
  );
}

function ExternalClientAppsSection({ org }: { org: OrgIdentity }) {
  const [result, setResult] = useState<QueryPage>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function load() {
    const requestId = crypto.randomUUID();
    setLoading(true);
    setError(undefined);
    try {
      const started = performance.now();
      const apps = await sendMessage<MetadataFileProperty[]>({
        type: 'GET_EXTERNAL_CLIENT_APPS',
        payload: { key: org.key, requestId },
      });
      setResult({
        totalSize: apps.length,
        done: true,
        elapsedMs: Math.round(performance.now() - started),
        records: apps.map((app) => ({
          Name: app.fullName,
          Namespace: app.namespacePrefix ?? 'None',
          PackageType: packageStateLabel(app.manageableState, app.namespacePrefix),
          ManageableState: app.manageableState ?? 'Local',
          LastModified: app.lastModifiedDate ?? '',
        })),
      });
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }

  useAutoLoad(load, `${org.key}:external-client-apps`);

  return (
    <section className="inventory-section" aria-labelledby="external-client-apps-title">
      <div className="inventory-section-heading">
        <div>
          <h2 id="external-client-apps-title">External Client Apps</h2>
          <p>Metadata visible to users permitted to read Salesforce metadata.</p>
        </div>
        <button
          className="button button-secondary"
          type="button"
          disabled={loading}
          onClick={() => void load()}
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>
      <InlineError message={error} />
      {result && (
        <QueryResults
          result={result}
          pageNumber={1}
          modeLabel="Metadata"
          loading={loading}
          columnLabels={{
            Name: 'External client app',
            Namespace: 'Namespace prefix',
            PackageType: 'Package type',
            ManageableState: 'Manageable state',
            LastModified: 'Last modified',
          }}
        />
      )}
    </section>
  );
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Salesforce could not complete this lookup.';
}
