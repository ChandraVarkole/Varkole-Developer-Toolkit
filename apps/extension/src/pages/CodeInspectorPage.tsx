import { useEffect, useMemo, useState } from 'react';
import type { OrgIdentity, QueryPage, RecordInspection } from '@varkole/shared';
import { sendMessage } from '../api';
import { CopyButton } from '../components/CopyButton';
import { EmptyState, InlineError } from '../components/Status';
import {
  CODE_INVENTORY,
  codeFilesFromRecords,
  codeResourceFromRecord,
  relatedCodeResources,
  sortCodeResources,
  sourceQuery,
  type CodeFile,
  type CodeResource,
} from './code-inspector';

const ALL_TYPES = 'All types';

export function CodeInspectorPage({
  org,
  currentRecordId,
}: {
  org?: OrgIdentity | undefined;
  currentRecordId?: string | undefined;
}) {
  const [resources, setResources] = useState<CodeResource[]>([]);
  const [selected, setSelected] = useState<CodeResource>();
  const [files, setFiles] = useState<CodeFile[]>([]);
  const [filter, setFilter] = useState('');
  const [kind, setKind] = useState<string>(ALL_TYPES);
  const [currentObject, setCurrentObject] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [loadingSource, setLoadingSource] = useState(false);
  const [error, setError] = useState<string>();
  const [partialNote, setPartialNote] = useState<string>();

  async function loadInventory() {
    if (!org) return;
    setLoading(true);
    setError(undefined);
    setPartialNote(undefined);
    try {
      const outcomes = await Promise.all(
        CODE_INVENTORY.map(async (definition) => {
          try {
            const result = await runToolingQuery(org, definition.query);
            return {
              definition,
              resources: result.records
                .map((record) => codeResourceFromRecord(definition.kind, record))
                .filter((resource): resource is CodeResource => Boolean(resource)),
            };
          } catch {
            return { definition, resources: undefined };
          }
        }),
      );
      const next = sortCodeResources(
        outcomes.flatMap((outcome) => outcome.resources ?? []),
        currentObject,
      );
      const unavailable = outcomes
        .filter((outcome) => !outcome.resources)
        .map((outcome) => outcome.definition.kind);
      setResources(next);
      setSelected((current) =>
        current ? next.find((resource) => resource.id === current.id) : next[0],
      );
      if (unavailable.length) {
        setPartialNote(`Not available through this org session: ${unavailable.join(', ')}.`);
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Salesforce code inventory could not load.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!org || !currentRecordId) return;
    void sendMessage<RecordInspection>({
      type: 'INSPECT_RECORD',
      payload: { key: org.key, recordId: currentRecordId },
    })
      .then((inspection) => setCurrentObject(inspection.objectApiName))
      .catch(() => undefined);
  }, [currentRecordId, org]);

  useEffect(() => {
    void loadInventory();
    // Load again only when the selected Salesforce connection changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org?.key]);

  useEffect(() => {
    if (!org || !selected) {
      setFiles([]);
      return;
    }
    let active = true;
    setLoadingSource(true);
    setError(undefined);
    void runToolingQuery(org, sourceQuery(selected))
      .then((result) => {
        if (active) setFiles(codeFilesFromRecords(selected, result.records));
      })
      .catch((cause: unknown) => {
        if (active) {
          setFiles([]);
          setError(
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
    return sortCodeResources(
      resources.filter(
        (resource) =>
          (kind === ALL_TYPES || resource.kind === kind) &&
          (!needle ||
            resource.name.toLowerCase().includes(needle) ||
            resource.objectApiName?.toLowerCase().includes(needle)),
      ),
      currentObject,
    );
  }, [currentObject, filter, kind, resources]);
  const related = selected ? relatedCodeResources(selected, files, resources) : [];

  if (!org) {
    return (
      <EmptyState
        title="Open a Salesforce org"
        description="Code Inspector uses accessible Tooling API metadata from the selected org."
      />
    );
  }

  return (
    <div className="page-stack code-inspector-page">
      <header className="page-header">
        <div>
          <div className="eyebrow">Local source · read-only</div>
          <h1>Code Inspector</h1>
          <p>Find accessible unmanaged Apex, LWC, Aura, and Visualforce source.</p>
        </div>
        <button
          className="button button-secondary button-compact"
          type="button"
          disabled={loading}
          onClick={() => void loadInventory()}
        >
          {loading ? 'Loading…' : 'Refresh code'}
        </button>
      </header>

      {currentObject && (
        <div className="code-context-note">
          <span>Current record object</span>
          <strong>{currentObject}</strong>
          <small>Matching triggers appear first.</small>
        </div>
      )}
      <InlineError message={error} />
      {partialNote && <p className="compact-note">{partialNote}</p>}

      <div className="code-inspector-layout">
        <aside className="code-resource-panel">
          <div className="code-resource-filters">
            <input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Search code or object…"
              type="search"
            />
            <select value={kind} onChange={(event) => setKind(event.target.value)}>
              <option>{ALL_TYPES}</option>
              {CODE_INVENTORY.map((definition) => (
                <option key={definition.kind}>{definition.kind}</option>
              ))}
            </select>
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
                  {resource.kind}
                  {resource.objectApiName ? ` · ${resource.objectApiName}` : ''}
                </span>
              </button>
            ))}
            {!loading && visibleResources.length === 0 && (
              <p className="muted">No accessible unmanaged code matches this search.</p>
            )}
          </div>
        </aside>

        <section className="code-source-panel">
          {!selected ? (
            <EmptyState
              title={loading ? 'Loading accessible source…' : 'Select a component'}
              description="Choose a code resource to inspect its source and references."
            />
          ) : (
            <>
              <div className="code-source-heading">
                <div>
                  <span>{selected.kind}</span>
                  <h2>{selected.name}</h2>
                  <small>
                    {selected.status ?? 'Local source'}
                    {selected.apiVersion ? ` · API v${selected.apiVersion}` : ''}
                  </small>
                </div>
                <CopyButton value={selected.name} label="Copy component name" />
              </div>

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
                <p className="muted">Salesforce returned no readable source for this component.</p>
              )}

              {related.length > 0 && (
                <div className="related-code">
                  <strong>Referenced accessible code</strong>
                  <div>
                    {related.map((resource) => (
                      <button type="button" key={resource.id} onClick={() => setSelected(resource)}>
                        {resource.name} <span>{resource.kind}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <p className="code-inspector-limit">
        Managed-package source and the exact runtime Lightning component tree are not exposed by
        Salesforce. Code Inspector shows only source available to the current user through supported
        APIs.
      </p>
    </div>
  );
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
