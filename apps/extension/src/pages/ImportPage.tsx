import { useEffect, useMemo, useState } from 'react';
import type {
  ImportOperation,
  ImportRecordResult,
  OrgIdentity,
  QueryPage,
  SalesforceObjectDescribe,
  SalesforceObjectSummary,
} from '@varkole/shared';
import { sendMessage } from '../api';
import { ObjectFieldPicker } from '../components/ObjectFieldPicker';
import { QueryResults } from '../components/QueryResults';
import { EmptyState, InlineError } from '../components/Status';
import { parseCsv } from './csv-parser';
import {
  autoMapImportHeaders,
  buildImportRecords,
  writableImportFields,
  type ImportFieldMapping,
} from './import-utils';

const MAX_IMPORT_ROWS = 2_000;
const BATCH_SIZE = 200;

export function ImportPage({ org }: { org?: OrgIdentity | undefined }) {
  const [objectApiName, setObjectApiName] = useState('');
  const [objects, setObjects] = useState<SalesforceObjectSummary[]>([]);
  const [describe, setDescribe] = useState<SalesforceObjectDescribe>();
  const [operation, setOperation] = useState<ImportOperation>('insert');
  const [csv, setCsv] = useState('');
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<ImportFieldMapping>({});
  const [error, setError] = useState<string>();
  const [confirmed, setConfirmed] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');
  const [executing, setExecuting] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [result, setResult] = useState<QueryPage>();

  useEffect(() => {
    if (!describe || !headers.length) return;
    setMapping(autoMapImportHeaders(headers, describe, operation));
    setConfirmed(false);
    setConfirmationText('');
    setResult(undefined);
  }, [describe, headers, operation]);

  const selectedObject = objects.find((object) => object.name === objectApiName);
  const writableFields = useMemo(
    () => (describe ? writableImportFields(describe, operation) : []),
    [describe, operation],
  );
  const preview = useMemo<QueryPage | undefined>(
    () =>
      rows.length
        ? {
            totalSize: rows.length,
            done: true,
            records: rows.slice(0, 50),
            elapsedMs: 0,
          }
        : undefined,
    [rows],
  );
  const preflight = useMemo(() => {
    if (!describe || !rows.length) return { records: [] as Record<string, unknown>[] };
    try {
      if (operation === 'insert' && !selectedObject?.createable) {
        throw new Error(
          `The current user cannot create ${selectedObject?.label ?? describe.label} records.`,
        );
      }
      if (operation === 'update' && !selectedObject?.updateable) {
        throw new Error(
          `The current user cannot update ${selectedObject?.label ?? describe.label} records.`,
        );
      }
      if (operation === 'delete' && !selectedObject?.deletable) {
        throw new Error(
          `The current user cannot delete ${selectedObject?.label ?? describe.label} records.`,
        );
      }
      return { records: buildImportRecords(rows, mapping, describe, operation) };
    } catch (cause) {
      return {
        records: [] as Record<string, unknown>[],
        error: cause instanceof Error ? cause.message : 'Import preflight failed.',
      };
    }
  }, [describe, mapping, operation, rows, selectedObject]);

  if (!org) {
    return (
      <EmptyState
        title="Open a Salesforce org"
        description="Import uses metadata and permissions from the selected org."
      />
    );
  }

  const typedConfirmation =
    operation === 'delete' ? `DELETE ${rows.length}` : `IMPORT ${rows.length}`;
  const confirmationRequired = operation === 'delete' || org.environment === 'production';
  const canExecute =
    Boolean(describe && preflight.records.length && !preflight.error) &&
    confirmed &&
    (!confirmationRequired || confirmationText === typedConfirmation) &&
    !executing;

  function analyze(value = csv) {
    setError(undefined);
    setResult(undefined);
    try {
      const parsed = parseCsv(value);
      if (!parsed.rows.length) throw new Error('CSV must contain at least one data row.');
      if (parsed.rows.length > MAX_IMPORT_ROWS) {
        throw new Error(
          `This browser import supports up to ${MAX_IMPORT_ROWS.toLocaleString()} rows per run.`,
        );
      }
      setHeaders(parsed.headers);
      setRows(parsed.rows);
    } catch (cause) {
      setHeaders([]);
      setRows([]);
      setMapping({});
      setError(cause instanceof Error ? cause.message : 'CSV could not be parsed.');
    }
  }

  async function selectFile(file?: File) {
    if (!file) return;
    setFileName(file.name);
    try {
      const text = await file.text();
      setCsv(text);
      analyze(text);
    } catch {
      setError('The selected CSV file could not be read.');
    }
  }

  async function executeImport() {
    if (!canExecute || !describe || !org) return;
    setExecuting(true);
    setError(undefined);
    setResult(undefined);
    setCompleted(0);
    const output: QueryPage['records'] = [];
    try {
      for (let offset = 0; offset < preflight.records.length; offset += BATCH_SIZE) {
        const batch = preflight.records.slice(offset, offset + BATCH_SIZE);
        const next = await sendMessage<ImportRecordResult[]>({
          type: 'IMPORT_RECORDS',
          payload: {
            key: org.key,
            objectApiName: describe.name,
            operation,
            records: batch,
            requestId: crypto.randomUUID(),
            confirmedIrreversible: confirmed,
            confirmedProduction:
              org.environment !== 'production' || confirmationText === typedConfirmation,
          },
        });
        next.forEach((item, index) => {
          output.push({
            Row: offset + index + 2,
            Success: item.success,
            Id: item.id ?? batch[index]?.Id ?? '',
            Result: item.success
              ? operation === 'insert'
                ? 'Created'
                : operation === 'delete'
                  ? 'Deleted'
                  : 'Updated'
              : item.errors.map((entry) => entry.message).join('; '),
          });
        });
        setCompleted(Math.min(offset + batch.length, preflight.records.length));
      }
      setResult({ totalSize: output.length, done: true, records: output, elapsedMs: 0 });
    } catch (cause) {
      if (output.length) {
        setResult({ totalSize: output.length, done: false, records: output, elapsedMs: 0 });
      }
      setError(
        `${cause instanceof Error ? cause.message : 'Salesforce could not complete the import.'} Review the completed rows below; successful changes were not automatically reverted.`,
      );
    } finally {
      setExecuting(false);
    }
  }

  return (
    <div className="page-stack import-page">
      <header className="page-header">
        <div>
          <div className="eyebrow">CSV data loader</div>
          <h1>Import</h1>
          <p>Upload, map, verify, and explicitly confirm Salesforce record changes.</p>
        </div>
      </header>

      <section className="section-card import-source-card">
        <div className="import-step-title">
          <span>1</span>
          <strong>Choose operation and object</strong>
        </div>
        <div className="import-operation-grid">
          <label>
            <span>Operation</span>
            <select
              value={operation}
              onChange={(event) => setOperation(event.target.value as ImportOperation)}
            >
              <option value="insert">Create records</option>
              <option value="update">Update records</option>
              <option value="delete">Delete records</option>
            </select>
          </label>
        </div>
        <ObjectFieldPicker
          org={org}
          objectApiName={objectApiName}
          onObjectApiNameChange={(value) => {
            setObjectApiName(value);
            setDescribe(undefined);
            setConfirmed(false);
          }}
          selectedFields={[]}
          onSelectedFieldsChange={() => undefined}
          onObjectsLoaded={setObjects}
          onDescribeLoaded={setDescribe}
          showFields={false}
        />
      </section>

      <section className="section-card import-source-card">
        <div className="import-step-title">
          <span>2</span>
          <strong>Upload or paste CSV</strong>
        </div>
        <label className="import-file-picker">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => void selectFile(event.target.files?.[0])}
          />
          <span>{fileName || 'Choose CSV file'}</span>
        </label>
        <textarea
          className="csv-editor"
          value={csv}
          onChange={(event) => setCsv(event.target.value)}
          spellCheck={false}
          aria-label="CSV import content"
          placeholder="Or paste CSV data here"
        />
        <div className="section-actions">
          <span className="muted">
            Up to {MAX_IMPORT_ROWS.toLocaleString()} rows · blank cells are ignored · use #NULL! to
            clear a field.
          </span>
          <button
            className="button button-secondary"
            type="button"
            disabled={!csv.trim()}
            onClick={() => analyze()}
          >
            Analyze CSV
          </button>
        </div>
      </section>

      <InlineError message={error} />

      {headers.length > 0 && describe && (
        <section className="section-card">
          <div className="import-step-title">
            <span>3</span>
            <strong>Map CSV columns</strong>
          </div>
          <div className="import-mapping-table">
            {headers.map((header) => (
              <label key={header}>
                <span>{header}</span>
                <select
                  value={mapping[header] ?? ''}
                  onChange={(event) =>
                    setMapping((current) => ({ ...current, [header]: event.target.value }))
                  }
                >
                  <option value="">Ignore this column</option>
                  {writableFields.map((field) => (
                    <option key={field.name} value={field.name}>
                      {field.label} ({field.name})
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          {preflight.error ? (
            <div className="mapping-status warning">
              <strong>Preflight needs attention</strong>
              <p>{preflight.error}</p>
            </div>
          ) : (
            <div className="mapping-status success">
              <strong>Preflight ready</strong>
              <p>
                {rows.length.toLocaleString()} rows are ready for {operation}.
              </p>
            </div>
          )}
        </section>
      )}

      {preview && (
        <section className="section-card">
          <div className="section-title">
            <div>
              <h2>CSV preview</h2>
              <p>
                Showing the first {Math.min(rows.length, 50)} rows. No Salesforce changes have
                occurred.
              </p>
            </div>
          </div>
          <QueryResults result={preview} pageNumber={1} modeLabel="Local CSV" loading={false} />
        </section>
      )}

      {describe && rows.length > 0 && (
        <section
          className={`import-confirmation ${operation === 'delete' || org.environment === 'production' ? 'danger' : ''}`}
        >
          <div className="import-step-title">
            <span>4</span>
            <strong>Confirm changes</strong>
          </div>
          <p>
            <strong>{operationLabel(operation)}</strong> {rows.length.toLocaleString()}{' '}
            {describe.label} records in <strong>{org.organizationName}</strong>.
          </p>
          <p>
            Salesforce permissions, validation rules, flows, and triggers still apply. Successfully
            processed changes cannot be reverted by Varkole.
          </p>
          <label className="confirmation-check">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            <span>I reviewed the mapping and understand these changes may be irreversible.</span>
          </label>
          {confirmationRequired && (
            <label>
              <span>Type {typedConfirmation}</span>
              <input
                value={confirmationText}
                onChange={(event) => setConfirmationText(event.target.value)}
                autoComplete="off"
              />
            </label>
          )}
          <button
            className={`button ${operation === 'delete' ? 'button-danger' : 'button-primary'}`}
            type="button"
            disabled={!canExecute}
            onClick={() => void executeImport()}
          >
            {executing
              ? `Processing ${completed.toLocaleString()} of ${rows.length.toLocaleString()}…`
              : `${operationLabel(operation)} records`}
          </button>
        </section>
      )}

      {result && (
        <section className="section-card">
          <div className="section-title">
            <div>
              <h2>Import results</h2>
              <p>Review every row. Failed rows were not retried automatically.</p>
            </div>
          </div>
          <QueryResults
            result={result}
            pageNumber={1}
            modeLabel="Salesforce write results"
            loading={false}
          />
        </section>
      )}
    </div>
  );
}

function operationLabel(operation: ImportOperation): string {
  if (operation === 'insert') return 'Create';
  if (operation === 'update') return 'Update';
  return 'Delete';
}
