import { useEffect, useMemo, useState } from 'react';
import type {
  OrgIdentity,
  QueryRecord,
  SalesforceObjectDescribe,
  SalesforceObjectSummary,
} from '@varkole/shared';
import { sendMessage } from '../api';
import { QueryResults } from '../components/QueryResults';
import { EmptyState, InlineError } from '../components/Status';
import { useAutoLoad } from '../useAutoLoad';

export function MetadataPage({ org }: { org?: OrgIdentity | undefined }) {
  const [objects, setObjects] = useState<SalesforceObjectSummary[]>([]);
  const [selectedName, setSelectedName] = useState('');
  const [describe, setDescribe] = useState<SalesforceObjectDescribe>();
  const [objectFilter, setObjectFilter] = useState('');
  const [loadingObjects, setLoadingObjects] = useState(false);
  const [loadingFields, setLoadingFields] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string>();

  async function loadObjects() {
    if (!org) return;
    setLoadingObjects(true);
    setError(undefined);
    try {
      const next = await sendMessage<SalesforceObjectSummary[]>({
        type: 'GET_OBJECTS',
        payload: { key: org.key },
      });
      setObjects(next);
      if (selectedName && !next.some((object) => object.name === selectedName)) setSelectedName('');
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Salesforce could not load object metadata.',
      );
    } finally {
      setLoadingObjects(false);
    }
  }

  useAutoLoad(loadObjects, org?.key);

  useEffect(() => {
    if (!org || !selectedName || !objects.some((object) => object.name === selectedName)) return;
    let active = true;
    const started = performance.now();
    setLoadingFields(true);
    setError(undefined);
    void sendMessage<SalesforceObjectDescribe>({
      type: 'DESCRIBE_OBJECT',
      payload: { key: org.key, objectApiName: selectedName },
    })
      .then((next) => {
        if (!active) return;
        setDescribe(next);
        setElapsedMs(Math.round(performance.now() - started));
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error ? cause.message : 'Salesforce could not describe the object.',
          );
        }
      })
      .finally(() => {
        if (active) setLoadingFields(false);
      });
    return () => {
      active = false;
    };
  }, [objects, org, selectedName]);

  const visibleObjects = useMemo(() => {
    const needle = objectFilter.trim().toLowerCase();
    return objects.filter(
      (object) =>
        !needle ||
        object.name.toLowerCase().includes(needle) ||
        object.label.toLowerCase().includes(needle),
    );
  }, [objectFilter, objects]);
  const selectedObject = objects.find((object) => object.name === selectedName);
  const fieldRecords = useMemo(() => describe?.fields.map(fieldMetadataRecord) ?? [], [describe]);

  if (!org) {
    return (
      <EmptyState
        title="Open a Salesforce org"
        description="Schema metadata is read from the selected Salesforce browser session."
      />
    );
  }

  return (
    <div className="page-stack metadata-page">
      <header className="page-header">
        <div>
          <div className="eyebrow">Schema · read-only</div>
          <h1>Schema Explorer</h1>
        </div>
        <button
          className="button button-secondary"
          type="button"
          disabled={loadingObjects}
          onClick={() => void loadObjects()}
        >
          {loadingObjects ? 'Loading…' : 'Refresh schema'}
        </button>
      </header>

      <InlineError message={error} />

      <div className="metadata-layout">
        <aside className="metadata-object-list">
          <label>
            <span>Find an object</span>
            <input
              value={objectFilter}
              onChange={(event) => setObjectFilter(event.target.value)}
              placeholder="Start typing object name"
            />
          </label>
          <div className="metadata-object-scroll">
            {visibleObjects.map((object) => (
              <button
                key={object.name}
                type="button"
                className={object.name === selectedName ? 'active' : ''}
                onClick={() => setSelectedName(object.name)}
              >
                <strong>{object.label}</strong>
                <small>{object.custom ? 'Custom' : 'Standard'}</small>
              </button>
            ))}
            {!loadingObjects && visibleObjects.length === 0 && (
              <p className="muted">No objects match this search.</p>
            )}
          </div>
        </aside>

        <div className="metadata-details">
          {selectedObject && (
            <section className="schema-object-hero">
              <div>
                <span className="badge badge-outline">
                  {selectedObject.custom ? 'Custom object' : 'Standard object'}
                </span>
                <h2>{selectedObject.label}</h2>
              </div>
              <div className="schema-capabilities">
                <SchemaCapability label="Queryable" enabled={selectedObject.queryable} />
                <SchemaCapability label="Searchable" enabled={selectedObject.searchable} />
                <SchemaCapability label="Create" enabled={selectedObject.createable} />
                <SchemaCapability label="Update" enabled={selectedObject.updateable} />
                <SchemaCapability label="Delete" enabled={selectedObject.deletable} />
              </div>
            </section>
          )}

          {describe && describe.name === selectedName && (
            <section className="schema-summary" aria-label="Field metadata summary">
              <SchemaMetric label="Fields" value={describe.fields.length} />
              <SchemaMetric
                label="Custom"
                value={describe.fields.filter((field) => field.custom).length}
              />
              <SchemaMetric
                label="Required"
                value={describe.fields.filter((field) => !field.nillable).length}
              />
              <SchemaMetric
                label="Writable"
                value={describe.fields.filter((field) => field.updateable).length}
              />
              <SchemaMetric
                label="Relationships"
                value={describe.fields.filter((field) => field.referenceTo?.length).length}
              />
              <SchemaMetric
                label="Picklists"
                value={describe.fields.filter((field) => field.picklistValues?.length).length}
              />
            </section>
          )}

          {loadingFields ? (
            <section className="section-card">
              <p className="muted">Loading live field metadata…</p>
            </section>
          ) : describe?.name === selectedName ? (
            <QueryResults
              result={{
                totalSize: fieldRecords.length,
                done: true,
                records: fieldRecords,
                elapsedMs,
              }}
              pageNumber={1}
              modeLabel="REST Describe"
              loading={false}
              recordBaseUrl={org.instanceUrl}
              columnLabels={{
                Label: 'Field',
                Type: 'Type',
                Required: 'Required',
                Access: 'Access',
                Formula: 'Formula',
                Size: 'Size',
                Relationship: 'Related object',
                PicklistValues: 'Picklist values',
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function fieldMetadataRecord(field: SalesforceObjectDescribe['fields'][number]): QueryRecord {
  const length = field.length ? String(field.length) : '';
  const precision = field.precision
    ? `${field.precision}${typeof field.scale === 'number' ? `, ${field.scale}` : ''}`
    : '';
  return {
    Label: field.label,
    Type: field.type,
    Required: field.nillable ? 'No' : 'Yes',
    Access:
      [field.createable ? 'Create' : '', field.updateable ? 'Update' : '']
        .filter(Boolean)
        .join(' · ') || 'Read only',
    Formula: field.calculated ? 'Yes' : 'No',
    Size: precision || length,
    Relationship: field.referenceTo?.join(', ') ?? '',
    PicklistValues:
      field.picklistValues
        ?.filter((value) => value.active)
        .map((value) =>
          value.label === value.value ? value.value : `${value.label} (${value.value})`,
        )
        .join(', ') ?? '',
  };
}

function SchemaCapability({ label, enabled }: { label: string; enabled?: boolean | undefined }) {
  return (
    <span className={enabled ? 'enabled' : ''}>
      {enabled ? '✓' : '—'} {label}
    </span>
  );
}

function SchemaMetric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <strong>{value.toLocaleString()}</strong>
      <span>{label}</span>
    </div>
  );
}
