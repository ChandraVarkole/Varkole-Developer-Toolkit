import { useEffect, useMemo, useState } from 'react';
import type {
  OrgIdentity,
  QueryPage,
  QueryRecord,
  SalesforceFieldSummary,
  SalesforceObjectDescribe,
  SalesforceObjectSummary,
} from '@varkole/shared';
import { sendMessage } from '../api';
import { ObjectFieldPicker } from '../components/ObjectFieldPicker';
import { sortSalesforceObjects } from '../components/object-suggestions';
import { QueryResults } from '../components/QueryResults';
import { EmptyState, InlineError } from '../components/Status';
import { useAutoLoad } from '../useAutoLoad';
import { buildRecordsQuery, inferObjectFromRecordId } from './records-query';
import { buildRecordFieldRows } from './record-fields';

export function RecordsPage({
  org,
  initialRecordId,
}: {
  org?: OrgIdentity | undefined;
  initialRecordId?: string | undefined;
}) {
  const [objectApiName, setObjectApiName] = useState('');
  const [fields, setFields] = useState('');
  const [recordId, setRecordId] = useState(initialRecordId ?? '');
  const [objects, setObjects] = useState<SalesforceObjectSummary[]>([]);
  const [describe, setDescribe] = useState<SalesforceObjectDescribe>();
  const [result, setResult] = useState<QueryPage>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [requestId, setRequestId] = useState<string>();
  const [pageNumber, setPageNumber] = useState(1);
  const [loadingContext, setLoadingContext] = useState(Boolean(initialRecordId));
  const inferredObject = useMemo(
    () => inferObjectFromRecordId(recordId, objects),
    [objects, recordId],
  );
  const activeDescribe = describe?.name === objectApiName ? describe : undefined;
  const recordMode = Boolean(recordId.trim());

  useEffect(() => {
    if (inferredObject && inferredObject.name !== objectApiName) {
      setObjectApiName(inferredObject.name);
      setResult(undefined);
    }
  }, [inferredObject, objectApiName]);

  useEffect(() => {
    if (initialRecordId && objects.length > 0 && !inferredObject) {
      setError(
        'Salesforce did not return an accessible object for this record ID. The current user may not have object access.',
      );
    }
  }, [inferredObject, initialRecordId, objects.length]);

  useEffect(() => {
    if (!org || !initialRecordId) return;
    let active = true;
    setLoadingContext(true);
    void sendMessage<SalesforceObjectSummary[]>({
      type: 'GET_OBJECTS',
      payload: { key: org.key },
    })
      .then((next) => {
        if (active) setObjects(sortSalesforceObjects(next));
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : 'Salesforce could not identify the record.',
          );
      })
      .finally(() => {
        if (active) setLoadingContext(false);
      });
    return () => {
      active = false;
    };
  }, [initialRecordId, org]);

  useEffect(() => {
    if (!org || !initialRecordId || !objectApiName) return;
    let active = true;
    void sendMessage<SalesforceObjectDescribe>({
      type: 'DESCRIBE_OBJECT',
      payload: { key: org.key, objectApiName },
    })
      .then((next) => {
        if (active) setDescribe(next);
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : 'Salesforce could not load field metadata.',
          );
      });
    return () => {
      active = false;
    };
  }, [initialRecordId, objectApiName, org]);

  async function run() {
    if (!org) return;
    let soql: string;
    try {
      soql = buildRecordsQuery({
        objectApiName,
        fields,
        recordId,
        inspectAllFields: recordMode,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The record query is invalid.');
      return;
    }
    const id = crypto.randomUUID();
    setRequestId(id);
    setLoading(true);
    setError(undefined);
    setPageNumber(1);
    try {
      setResult(
        await sendMessage<QueryPage>({
          type: 'RUN_QUERY',
          payload: { key: org.key, soql, mode: 'rest', requestId: id },
        }),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Salesforce could not load records.');
    } finally {
      setLoading(false);
      setRequestId(undefined);
    }
  }

  const contextReady =
    !initialRecordId || (inferredObject && inferredObject.name === objectApiName);
  useAutoLoad(
    run,
    org && initialRecordId && contextReady
      ? `${org.key}:${objectApiName}:${initialRecordId}`
      : undefined,
  );

  if (!org) {
    return (
      <EmptyState
        title="Open a Salesforce org"
        description="Record access uses the selected Salesforce browser session."
      />
    );
  }

  async function nextPage() {
    if (!org || !result?.nextRecordsUrl) return;
    const id = crypto.randomUUID();
    setRequestId(id);
    setLoading(true);
    setError(undefined);
    try {
      setResult(
        await sendMessage<QueryPage>({
          type: 'QUERY_NEXT',
          payload: { key: org.key, nextRecordsUrl: result.nextRecordsUrl, requestId: id },
        }),
      );
      setPageNumber((page) => page + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Salesforce could not load the next page.');
    } finally {
      setLoading(false);
      setRequestId(undefined);
    }
  }

  async function cancel() {
    if (!requestId) return;
    await sendMessage<void>({ type: 'CANCEL_REQUEST', payload: { requestId } });
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <div className="eyebrow">
            {initialRecordId ? 'Current Salesforce record · read-only' : 'Read-only utility'}
          </div>
          <h1>Record Inspector</h1>
          {!initialRecordId && <p>Choose an object or paste a record ID.</p>}
        </div>
        {initialRecordId && (
          <div className="record-inspector-header-actions">
            <div className="current-record-detected">
              <span>Current record</span>
              <code>{initialRecordId}</code>
            </div>
            <button
              className="button button-primary"
              type="button"
              disabled={loading || !objectApiName}
              onClick={() => void run()}
            >
              {loading ? 'Refreshing…' : 'Refresh inspection'}
            </button>
          </div>
        )}
      </header>

      {!initialRecordId && (
        <section className="section-card">
          <ObjectFieldPicker
            org={org}
            objectApiName={objectApiName}
            onObjectApiNameChange={setObjectApiName}
            selectedFields={fields
              .split(',')
              .map((field) => field.trim())
              .filter(Boolean)}
            onSelectedFieldsChange={(next) => setFields(next.join(', '))}
            onObjectsLoaded={setObjects}
            onDescribeLoaded={setDescribe}
          />
          <div className="form-grid records-form-grid">
            <label>
              <span>Record ID (optional)</span>
              <input
                value={recordId}
                onChange={(event) => {
                  setRecordId(event.target.value);
                  setResult(undefined);
                }}
                placeholder="15 or 18-character ID"
              />
              {inferredObject && (
                <small className="input-hint">Detected {inferredObject.label}</small>
              )}
            </label>
          </div>
          <div className="section-actions">
            <span />
            {loading ? (
              <button
                className="button button-danger-outline"
                type="button"
                onClick={() => void cancel()}
              >
                Stop
              </button>
            ) : (
              <button
                className="button button-primary"
                type="button"
                disabled={!objectApiName || (!recordMode && !fields.trim())}
                onClick={() => void run()}
              >
                {recordMode
                  ? result
                    ? 'Refresh inspection'
                    : 'Inspect record'
                  : result
                    ? 'Refresh records'
                    : 'Load records'}
              </button>
            )}
          </div>
        </section>
      )}

      <InlineError message={error} />
      {initialRecordId && loadingContext && !result && (
        <section className="section-card">
          <p className="muted">Identifying the current record and loading accessible fields…</p>
        </section>
      )}
      {result && recordMode && result.records[0] ? (
        <RecordDetail
          record={result.records[0]}
          describe={activeDescribe}
          object={objects.find((candidate) => candidate.name === objectApiName)}
          instanceUrl={org.instanceUrl}
        />
      ) : result ? (
        <QueryResults
          result={result}
          pageNumber={pageNumber}
          modeLabel="REST"
          loading={loading}
          onNext={() => void nextPage()}
          recordBaseUrl={org.instanceUrl}
        />
      ) : null}
    </div>
  );
}

function RecordDetail({
  record,
  describe,
  object,
  instanceUrl,
}: {
  record: QueryRecord;
  describe?: SalesforceObjectDescribe | undefined;
  object?: SalesforceObjectSummary | undefined;
  instanceUrl: string;
}) {
  const [filter, setFilter] = useState('');
  const fields = buildRecordFieldRows(record, describe?.fields, filter);
  const id = typeof record.Id === 'string' ? record.Id : undefined;

  return (
    <section className="record-detail-card">
      <div className="record-detail-header">
        <div>
          <div className="eyebrow">Single-record inspection</div>
          <h2>{recordDisplayName(record, describe?.label ?? object?.label ?? 'Record')}</h2>
        </div>
        <div className="record-detail-actions">
          <span className="badge badge-outline">{describe?.label ?? object?.label}</span>
          {id && (
            <a
              className="button button-secondary"
              href={`${instanceUrl}/${id}`}
              target="_blank"
              rel="noreferrer"
            >
              Open in Salesforce ↗
            </a>
          )}
        </div>
      </div>
      <label className="record-field-filter">
        <span className="sr-only">Filter inspected fields</span>
        <input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Search field label, API name, type, or value…"
        />
      </label>
      <div className="record-field-list">
        {fields.map(({ name, value, field }) => (
          <RecordField key={name} name={name} value={value} field={field} />
        ))}
      </div>
      {fields.length === 0 && <p className="muted">No fields match this filter.</p>}
    </section>
  );
}

function RecordField({
  name,
  value,
  field,
}: {
  name: string;
  value: unknown;
  field?: SalesforceFieldSummary | undefined;
}) {
  const formatted = formatRecordValue(value);
  return (
    <article className="record-field">
      <div className="record-field-name">
        <strong>{field?.label ?? name}</strong>
        <code>{name}</code>
      </div>
      <p className={formatted ? '' : 'null'}>{formatted || 'null'}</p>
      <div className="field-meta">
        <span>{field?.type ?? typeof value}</span>
        {typeof field?.length === 'number' && field.length > 0 && (
          <span>Length {field.length}</span>
        )}
        {typeof field?.precision === 'number' && field.precision > 0 && (
          <span>
            Precision {field.precision}
            {typeof field.scale === 'number' ? ` · Scale ${field.scale}` : ''}
          </span>
        )}
        {field?.calculated && <span>Formula</span>}
        {field && !field.updateable && <span>Read only</span>}
        {field && !field.nillable && <span>Required</span>}
        {field?.custom && <span>Custom</span>}
        {field?.referenceTo?.length ? <span>→ {field.referenceTo.join(', ')}</span> : null}
      </div>
    </article>
  );
}

function recordDisplayName(record: QueryRecord, fallback: string) {
  for (const key of ['Name', 'Subject', 'CaseNumber', 'Username']) {
    const value = record[key];
    if (typeof value === 'string' && value) return value;
  }
  return fallback;
}

function formatRecordValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return '';
}
