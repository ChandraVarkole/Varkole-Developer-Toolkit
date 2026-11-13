import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type {
  CustomTabMetadata,
  OrgIdentity,
  QueryPage,
  QuickActionMetadata,
  RecordInspection,
} from '@varkole/shared';
import { sendMessage } from '../api';
import type { ComponentPickResult, PickedComponentContext } from '../component-picker';
import { CopyButton } from '../components/CopyButton';
import { EmptyState, InlineError } from '../components/Status';
import {
  activeRecordPageOverride,
  codeNameSearchQueries,
  codeResourcesFromReverseDependencies,
  codeResourcesFromSearchRecords,
  codeSearchSosl,
  codeFilesFromRecords,
  codeResourceFromRecord,
  codeResourcesFromDependencies,
  customTabTargetQueries,
  customTabDependencyQuery,
  dependencyQuery,
  directContextQueries,
  flowComponentQueriesFromRecords,
  flowTargetQueries,
  overrideResourceQuery,
  pageContextFromSalesforceUrl,
  pickedComponentQueries,
  quickActionDependencyQuery,
  quickActionTargetQueries,
  recordTriggerQuery,
  reverseDependencyQuery,
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
  embedded,
  pickedComponent,
  componentPickResult,
  onClearPickedComponent,
}: {
  org?: OrgIdentity | undefined;
  currentRecordId?: string | undefined;
  currentPageUrl?: string | undefined;
  embedded: boolean;
  pickedComponent?: PickedComponentContext | undefined;
  componentPickResult?: ComponentPickResult | undefined;
  onClearPickedComponent: () => void;
}) {
  const [resources, setResources] = useState<CodeResource[]>([]);
  const [selected, setSelected] = useState<CodeResource>();
  const [files, setFiles] = useState<CodeFile[]>([]);
  const [filter, setFilter] = useState('');
  const [manualSearch, setManualSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string>();
  const [currentObject, setCurrentObject] = useState<string>();
  const [currentTabLabel, setCurrentTabLabel] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [loadingSource, setLoadingSource] = useState(false);
  const [error, setError] = useState<string>();
  const [sourceError, setSourceError] = useState<string>();
  const [contextNote, setContextNote] = useState<string>();
  const [picking, setPicking] = useState(false);
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
      if (pickedComponent) {
        if (pickedComponent.metadataType === 'QuickAction' && pickedComponent.metadataName) {
          try {
            const action = await sendMessage<QuickActionMetadata>({
              type: 'GET_QUICK_ACTION',
              payload: { key: org.key, actionName: pickedComponent.metadataName },
            });
            roots.push(...(await runDefinitions(org, quickActionTargetQueries(action))));
          } catch {
            // Dependency metadata below remains available when Quick Action metadata is restricted.
          }
          try {
            const actionDependencies = await runToolingQuery(
              org,
              quickActionDependencyQuery(pickedComponent.metadataName),
            );
            roots.push(
              ...codeResourcesFromDependencies(actionDependencies.records, 'Selected component'),
            );
          } catch {
            // Exact bundle lookup below remains available when dependency metadata is restricted.
          }
        } else if (pickedComponent.metadataType === 'CustomTab' && pickedComponent.metadataName) {
          try {
            const tab = await sendMessage<CustomTabMetadata>({
              type: 'GET_CUSTOM_TAB',
              payload: { key: org.key, tabName: pickedComponent.metadataName },
            });
            setCurrentTabLabel(tab.label ?? tab.fullName);
            roots.push(...(await runDefinitions(org, customTabTargetQueries(tab))));
          } catch {
            // Exact same-name component lookup below remains available.
          }
        } else if (pickedComponent.metadataType === 'Flow' && pickedComponent.metadataName) {
          roots.push(
            ...(await runDefinitions(org, flowTargetQueries(pickedComponent.metadataName))),
          );
        }
        if (!roots.length) {
          roots.push(...(await runDefinitions(org, pickedComponentQueries(pickedComponent))));
        }
        if (!roots.length) {
          setContextNote(
            pickedComponent.metadataType
              ? `Salesforce identified ${pickedComponent.metadataName}, but did not expose an accessible backing Flow or component through metadata.`
              : `Salesforce rendered ${pickedComponent.componentName}, but its bundle metadata is not readable in this session.`,
          );
        }
      } else {
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
      }

      const rootResources = sortContextResources(roots);
      const flowComponentDefinitions: CodeQueryDefinition[] = [];
      for (const flow of rootResources.filter((resource) => resource.kind === 'Flow')) {
        try {
          const flowSource = await runToolingQuery(org, sourceQuery(flow));
          flowComponentDefinitions.push(...flowComponentQueriesFromRecords(flowSource.records));
        } catch {
          // Managed or restricted Flow metadata can remain hidden while its inventory row is visible.
        }
      }
      const related = await runDefinitions(org, flowComponentDefinitions);
      related.push(
        ...(await loadDependencyGraph(
          org,
          rootResources.map((resource) => resource.id),
        )),
      );

      const next = sortContextResources([...rootResources, ...related]);
      setResources(next);
      setSelected((current) =>
        current ? (next.find((resource) => resource.id === current.id) ?? next[0]) : next[0],
      );
      if (!next.length) {
        setContextNote(
          (note) =>
            note ??
            (pickedComponent
              ? `No accessible source was returned for the selected ${pickedComponent.componentName} component.`
              : currentPageUrl
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
  }, [org?.key, currentRecordId, currentPageUrl, pickedComponent]);

  useEffect(() => {
    if (!componentPickResult) return;
    setPicking(false);
    if (componentPickResult.status !== 'found') setContextNote(componentPickResult.message);
  }, [componentPickResult]);

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

  const selectedDependencies = useMemo(
    () => (selected ? resources.filter((resource) => resource.parentId === selected.id) : []),
    [resources, selected],
  );
  const selectedParent = useMemo(
    () =>
      selected?.parentId
        ? resources.find((resource) => resource.id === selected.parentId)
        : undefined,
    [resources, selected],
  );

  if (!org) {
    return (
      <EmptyState
        title="Open a Salesforce org"
        description="Code Inspector reads only code related to the current Salesforce page."
      />
    );
  }

  function startComponentPick() {
    if (!embedded || window.parent === window) return;
    setPicking(true);
    setError(undefined);
    setContextNote('Click a quick action, tab, modal, or component in the Salesforce page.');
    window.parent.postMessage({ type: 'VARKOLE_START_COMPONENT_PICK' }, '*');
  }

  async function searchAccessibleCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!org) return;
    const term = manualSearch.trim();
    if (!term) return;
    setSearching(true);
    setSearchError(undefined);
    try {
      const nameDefinitions = codeNameSearchQueries(term);
      const [nameMatches, indexedSearch] = await Promise.all([
        runDefinitions(org, nameDefinitions),
        sendMessage<QueryPage>({
          type: 'SEARCH_CODE',
          payload: {
            key: org.key,
            sosl: codeSearchSosl(term),
            requestId: crypto.randomUUID(),
          },
        }).catch(() => undefined),
      ]);
      const roots = sortContextResources([
        ...nameMatches,
        ...codeResourcesFromSearchRecords(indexedSearch?.records ?? []),
      ]);
      if (!roots.length) {
        setResources([]);
        setSelected(undefined);
        setContextNote(`No accessible code or metadata matched “${term}”.`);
        return;
      }

      const related: CodeResource[] = [];
      const flowDefinitions: CodeQueryDefinition[] = [];
      for (const flow of roots.filter((resource) => resource.kind === 'Flow')) {
        try {
          const flowSource = await runToolingQuery(org, sourceQuery(flow));
          flowDefinitions.push(...flowComponentQueriesFromRecords(flowSource.records));
        } catch {
          // Other search matches and dependency metadata remain available.
        }
      }
      related.push(...(await runDefinitions(org, flowDefinitions)));

      related.push(
        ...(await loadDependencyGraph(
          org,
          roots.map((resource) => resource.id),
        )),
      );

      const next = sortContextResources([...roots, ...related]);
      setResources(next);
      setSelected(roots[0]);
      setFilter('');
      setContextNote(
        `Found ${roots.length} accessible match${roots.length === 1 ? '' : 'es'} for “${term}” and loaded ${related.length} exposed dependency link${related.length === 1 ? '' : 's'}.`,
      );
    } catch (cause) {
      setSearchError(
        cause instanceof Error ? cause.message : 'Salesforce code search could not be completed.',
      );
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="page-stack code-inspector-page">
      <header className="page-header">
        <div>
          <div className="eyebrow">Current context · read-only</div>
          <h1>Code Inspector</h1>
          <p>See only the accessible UI and Apex components related to this Salesforce page.</p>
        </div>
        <div className="page-header-actions">
          {pickedComponent && (
            <button
              className="button button-ghost button-compact"
              type="button"
              onClick={onClearPickedComponent}
            >
              Inspect page instead
            </button>
          )}
          <button
            className="button button-primary button-compact"
            type="button"
            disabled={!embedded || picking}
            onClick={startComponentPick}
            title={
              embedded ? 'Select a component in Salesforce' : 'Available in the embedded drawer'
            }
          >
            {picking ? 'Click in Salesforce…' : 'Pick component'}
          </button>
          <button
            className="button button-secondary button-compact"
            type="button"
            disabled={loading}
            onClick={() => void loadCurrentContext()}
          >
            {loading ? 'Inspecting…' : 'Refresh'}
          </button>
        </div>
      </header>

      <div className="code-context-note">
        <span>
          {pickedComponent
            ? 'Selected UI component'
            : `${pageContext?.experience ?? 'Salesforce'} context`}
        </span>
        <strong>
          {pickedComponent?.componentName ??
            currentObject ??
            currentTabLabel ??
            pageContext?.visualforceName ??
            pageContext?.componentName ??
            'Current page'}
        </strong>
        <small>
          {pickedComponent
            ? `${pickedComponent.metadataType ?? pickedComponent.kindHint.toUpperCase()}${pickedComponent.namespace ? ` · ${pickedComponent.namespace}` : ''}`
            : currentRecordId
              ? `Record ${currentRecordId}`
              : (pageContext?.pathname ?? 'Open the embedded extension from Salesforce')}
        </small>
      </div>
      <InlineError message={error} />
      {contextNote && <p className="compact-note">{contextNote}</p>}

      <div className="code-inspector-layout">
        <aside className="code-resource-panel">
          <div className="code-resource-filters">
            <form
              className="code-search-form"
              onSubmit={(event) => void searchAccessibleCode(event)}
            >
              <label htmlFor="code-search">Find by name or function</label>
              <div>
                <input
                  id="code-search"
                  value={manualSearch}
                  onChange={(event) => setManualSearch(event.target.value)}
                  placeholder="Component, class, Flow, feature…"
                  type="search"
                />
                <button
                  className="button button-primary button-compact"
                  type="submit"
                  disabled={searching || manualSearch.trim().length < 2}
                >
                  {searching ? 'Searching…' : 'Find'}
                </button>
              </div>
              <small>
                Searches accessible metadata and indexed source, then follows three dependency
                levels.
              </small>
            </form>
            <InlineError message={searchError} />
            <input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Filter loaded results…"
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
                  {selectedParent && (
                    <small className="dependency-path">
                      {selected.relationship === 'Used by'
                        ? `${selected.name} → ${selectedParent.name}`
                        : `${selectedParent.name} → ${selected.name}`}
                    </small>
                  )}
                </div>
                <CopyButton value={selected.name} label="Copy component name" />
              </div>

              {selectedDependencies.length > 0 && (
                <div className="related-code">
                  <strong>Dependency map</strong>
                  <div>
                    {selectedDependencies.map((resource) => (
                      <button
                        type="button"
                        key={`${resource.relationship}-${resource.id}`}
                        onClick={() => setSelected(resource)}
                      >
                        {resource.relationship === 'Used by'
                          ? `${resource.name} → ${selected.name}`
                          : `${selected.name} → ${resource.name}`}
                        <span>{resource.kind}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

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
        Pick component reads only Salesforce component identity markers from the click path or newly
        rendered UI. It never reads field values, input values, or page text. Varkole then follows
        Salesforce dependency metadata and shows only source available to this user; protected
        managed-package internals remain hidden.
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

async function runOptionalToolingQuery(
  org: OrgIdentity,
  soql?: string,
): Promise<QueryPage | undefined> {
  if (!soql) return undefined;
  try {
    return await runToolingQuery(org, soql);
  } catch {
    return undefined;
  }
}

async function loadDependencyGraph(
  org: OrgIdentity,
  rootIds: string[],
  maximumDepth = 3,
  maximumResources = 200,
): Promise<CodeResource[]> {
  const seen = new Set(rootIds);
  let frontier = [...seen];
  const resources: CodeResource[] = [];

  for (let depth = 0; depth < maximumDepth && frontier.length; depth += 1) {
    const [usesResult, usedByResult] = await Promise.all([
      runOptionalToolingQuery(org, dependencyQuery(frontier)),
      runOptionalToolingQuery(org, reverseDependencyQuery(frontier)),
    ]);
    const level = [
      ...codeResourcesFromDependencies(usesResult?.records ?? [], 'Uses'),
      ...codeResourcesFromReverseDependencies(usedByResult?.records ?? []),
    ];
    const next: string[] = [];
    for (const resource of level) {
      resources.push(resource);
      if (!seen.has(resource.id) && seen.size < maximumResources) {
        seen.add(resource.id);
        next.push(resource.id);
      }
      if (resources.length >= maximumResources) return resources;
    }
    frontier = next;
  }
  return resources;
}
