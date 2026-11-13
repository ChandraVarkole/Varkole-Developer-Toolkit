import { useEffect, useMemo, useState } from 'react';
import type { CustomTabMetadata, OrgIdentity, QueryPage, RecordInspection } from '@varkole/shared';
import { sendMessage } from '../api';
import { CopyButton } from '../components/CopyButton';
import { EmptyState, InlineError } from '../components/Status';
import {
  activeRecordPageOverride,
  codeFilesFromRecords,
  codeResourceFromRecord,
  codeResourcesFromDependencies,
  customTabTargetQueries,
  customTabDependencyQuery,
  dependencyQuery,
  directContextQueries,
  overrideResourceQuery,
  pageContextFromSalesforceUrl,
  recordTriggerQuery,
  sortContextResources,
  sourceQuery,
  type CodeFile,
  type CodeResource,
  type CodeResourceKind,
} from './code-inspector';

interface CodeQueryDefinition {
  kind: CodeResourceKind;
  query: string;
  relationship?: CodeResource['relationship'];
}

export function CodeInspectorPage({
  org,
  currentRecordId,
  currentPageUrl,
}: {
  org?: OrgIdentity | undefined;
  currentRecordId?: string | undefined;
  currentPageUrl?: string | undefined;
}) {
  const [resources, setResources] = useState<CodeResource[]>([]);
  const [selected, setSelected] = useState<CodeResource>();
  const [files, setFiles] = useState<CodeFile[]>([]);
  const [filter, setFilter] = useState('');
  const [currentObject, setCurrentObject] = useState<string>();
  const [currentTabLabel, setCurrentTabLabel] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [loadingSource, setLoadingSource] = useState(false);
  const [error, setError] = useState<string>();
  const [sourceError, setSourceError] = useState<string>();
  const [contextNote, setContextNote] = useState<string>();
  const pageContext = useMemo(() => pageContextFromSalesforceUrl(currentPageUrl), [currentPageUrl]);

  async function loadCurrentContext() {
    if (!org) return;
    setLoading(true);
    setError(undefined);
    setContextNote(undefined);
    setCurrentObject(undefined);
    setCurrentTabLabel(undefined);
    try {
      const roots: CodeResource[] = [];
      roots.push(...(await runDefinitions(org, directContextQueries(pageContext))));

      if (pageContext?.navigationTabName) {
        let tabDependencyResources: CodeResource[] = [];
        try {
          const dependencyResult = await runToolingQuery(
            org,
            customTabDependencyQuery(pageContext.navigationTabName),
          );
          tabDependencyResources = codeResourcesFromDependencies(
            dependencyResult.records,
            'Current page',
          );
          roots.push(...tabDependencyResources);
        } catch {
          // Custom Tab dependencies aren't exposed in every org/API version. Metadata API is next.
        }
        try {
          const tab = await sendMessage<CustomTabMetadata>({
            type: 'GET_CUSTOM_TAB',
            payload: { key: org.key, tabName: pageContext.navigationTabName },
          });
          setCurrentTabLabel(tab.label ?? tab.fullName);
          let targets = customTabTargetQueries(tab);
          if (!targets.length && tab.url) {
            targets = directContextQueries(
              pageContextFromSalesforceUrl(new URL(tab.url, org.instanceUrl).href),
            );
          }
          roots.push(...(await runDefinitions(org, targets)));
          if (!targets.length) {
            setContextNote(
              tab.customObject
                ? 'This navigation item opens a custom object tab rather than a custom UI component.'
                : 'Salesforce returned this custom tab but did not expose a supported component target.',
            );
          }
        } catch {
          setCurrentTabLabel(pageContext.navigationTabName);
          if (!tabDependencyResources.length) {
            roots.push(
              ...(await runDefinitions(org, [
                ...directContextQueries({
                  ...pageContext,
                  componentName: pageContext.navigationTabName,
                }),
              ])),
            );
            setContextNote(
              'The Custom Tab metadata was not readable, so Varkole tried an exact same-name component lookup.',
            );
          }
        }
      }

      if (currentRecordId) {
        const inspection = await sendMessage<RecordInspection>({
          type: 'INSPECT_RECORD',
          payload: { key: org.key, recordId: currentRecordId },
        });
        setCurrentObject(inspection.objectApiName);

        const triggers = await runToolingQuery(org, recordTriggerQuery(inspection.objectApiName));
        roots.push(
          ...triggers.records
            .map((record) => codeResourceFromRecord('Apex trigger', record, 'Object automation'))
            .filter((resource): resource is CodeResource => Boolean(resource)),
        );

        const override = activeRecordPageOverride(
          inspection.describe,
          pageContext?.experience ?? 'Classic',
        );
        if (override?.pageId) {
          roots.push(...(await runDefinitions(org, overrideResourceQuery(override.pageId))));
        } else if (override?.url) {
          const overrideUrl = new URL(override.url, org.instanceUrl).href;
          roots.push(
            ...(await runDefinitions(
              org,
              directContextQueries(pageContextFromSalesforceUrl(overrideUrl)),
            )),
          );
        } else if (!roots.some((resource) => resource.relationship === 'Current page')) {
          setContextNote(
            `This is the standard ${pageContext?.experience ?? 'Salesforce'} ${inspection.objectApiName} record page. No custom page source was exposed; object triggers are shown when available.`,
          );
        }
      }

      const rootResources = sortContextResources(roots);
      const relatedQuery = dependencyQuery(rootResources.map((resource) => resource.id));
      let related: CodeResource[] = [];
      if (relatedQuery) {
        try {
          const dependencyResult = await runToolingQuery(org, relatedQuery);
          related = codeResourcesFromDependencies(dependencyResult.records);
        } catch {
          setContextNote((note) =>
            note
              ? `${note} Salesforce did not expose dependency metadata for this context.`
              : 'Salesforce did not expose dependency metadata for this context.',
          );
        }
      }

      const next = sortContextResources([...rootResources, ...related]);
      setResources(next);
      setSelected((current) =>
        current ? (next.find((resource) => resource.id === current.id) ?? next[0]) : next[0],
      );
      if (!next.length) {
        setContextNote(
          (note) =>
            note ??
            (currentPageUrl
              ? 'No accessible UI or Apex component is directly associated with this page.'
              : 'Open Code Inspector from a Salesforce record, Visualforce page, component, or Apex setup page.'),
        );
      }
    } catch (cause) {
      setResources([]);
      setSelected(undefined);
      setError(
        cause instanceof Error
          ? cause.message
          : 'The code related to the current Salesforce page could not be inspected.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCurrentContext();
    // Refresh when the selected org or the Salesforce page changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org?.key, currentRecordId, currentPageUrl]);

  useEffect(() => {
    if (!org || !selected) {
      setFiles([]);
      return;
    }
    let active = true;
    setLoadingSource(true);
    setSourceError(undefined);
    void runToolingQuery(org, sourceQuery(selected))
      .then((result) => {
        if (active) setFiles(codeFilesFromRecords(selected, result.records));
      })
      .catch((cause: unknown) => {
        if (active) {
          setFiles([]);
          setSourceError(
            cause instanceof Error
              ? cause.message
              : 'Salesforce did not make this source available.',
          );
        }
      })
      .finally(() => {
        if (active) setLoadingSource(false);
      });
    return () => {
      active = false;
    };
  }, [org, selected]);

  const visibleResources = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    return resources.filter(
      (resource) =>
        !needle ||
        resource.name.toLowerCase().includes(needle) ||
        resource.kind.toLowerCase().includes(needle) ||
        resource.relationship.toLowerCase().includes(needle),
    );
  }, [filter, resources]);

  if (!org) {
    return (
      <EmptyState
        title="Open a Salesforce org"
        description="Code Inspector reads only code related to the current Salesforce page."
      />
    );
  }

  return (
    <div className="page-stack code-inspector-page">
      <header className="page-header">
        <div>
          <div className="eyebrow">Current context · read-only</div>
          <h1>Code Inspector</h1>
          <p>See only the accessible UI and Apex components related to this Salesforce page.</p>
        </div>
        <button
          className="button button-secondary button-compact"
          type="button"
          disabled={loading}
          onClick={() => void loadCurrentContext()}
        >
          {loading ? 'Inspecting…' : 'Refresh inspection'}
        </button>
      </header>

      <div className="code-context-note">
        <span>{pageContext?.experience ?? 'Salesforce'} context</span>
        <strong>
          {currentObject ??
            currentTabLabel ??
            pageContext?.visualforceName ??
            pageContext?.componentName ??
            'Current page'}
        </strong>
        <small>
          {currentRecordId
            ? `Record ${currentRecordId}`
            : (pageContext?.pathname ?? 'Open the embedded extension from Salesforce')}
        </small>
      </div>
      <InlineError message={error} />
      {contextNote && <p className="compact-note">{contextNote}</p>}

      <div className="code-inspector-layout">
        <aside className="code-resource-panel">
          <div className="code-resource-filters">
            <input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Filter related components…"
              type="search"
            />
          </div>
          <div className="code-resource-list">
            {visibleResources.map((resource) => (
              <button
                className={selected?.id === resource.id ? 'active' : ''}
                type="button"
                key={resource.id}
                onClick={() => setSelected(resource)}
              >
                <strong>{resource.name}</strong>
                <span>
                  {resource.kind} · {resource.relationship}
                </span>
              </button>
            ))}
            {!loading && visibleResources.length === 0 && (
              <p className="muted">No related accessible components to show.</p>
            )}
          </div>
        </aside>

        <section className="code-source-panel">
          {!selected ? (
            <EmptyState
              title={loading ? 'Inspecting the current page…' : 'No local source detected'}
              description="Navigate to a Salesforce record, Visualforce page, component, or Apex setup page, then refresh."
            />
          ) : (
            <>
              <div className="code-source-heading">
                <div>
                  <span>{selected.relationship}</span>
                  <h2>{selected.name}</h2>
                  <small>
                    {selected.kind}
                    {selected.status ? ` · ${selected.status}` : ''}
                    {selected.apiVersion ? ` · API v${selected.apiVersion}` : ''}
                  </small>
                </div>
                <CopyButton value={selected.name} label="Copy component name" />
              </div>

              <InlineError message={sourceError} />
              {loadingSource ? (
                <p className="muted">Loading source from Salesforce…</p>
              ) : files.length ? (
                <div className="code-file-list">
                  {files.map((file) => (
                    <article className="code-file" key={file.name}>
                      <header>
                        <code>{file.name}</code>
                        <CopyButton
                          value={file.source}
                          label={`Copy ${file.name} source`}
                          compact
                        />
                      </header>
                      <pre>
                        <code>{file.source}</code>
                      </pre>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="muted">
                  This component is related to the current page, but its source is not readable in
                  this Salesforce session.
                </p>
              )}
            </>
          )}
        </section>
      </div>

      <p className="code-inspector-limit">
        Varkole does not scan the entire org or scrape the rendered page. It follows the current
        record/page metadata and Salesforce dependency metadata, then shows only source available to
        this user. Managed-package internals remain hidden.
      </p>
    </div>
  );
}

async function runDefinitions(
  org: OrgIdentity,
  definitions: CodeQueryDefinition[],
): Promise<CodeResource[]> {
  const outcomes = await Promise.all(
    definitions.map(async (definition) => {
      try {
        const result = await runToolingQuery(org, definition.query);
        return result.records
          .map((record) =>
            codeResourceFromRecord(
              definition.kind,
              record,
              definition.relationship ?? 'Current page',
            ),
          )
          .filter((resource): resource is CodeResource => Boolean(resource));
      } catch {
        return [];
      }
    }),
  );
  return outcomes.flat();
}

async function runToolingQuery(org: OrgIdentity, soql: string): Promise<QueryPage> {
  return sendMessage<QueryPage>({
    type: 'RUN_QUERY',
    payload: {
      key: org.key,
      soql,
      mode: 'tooling',
      requestId: crypto.randomUUID(),
    },
  });
}
