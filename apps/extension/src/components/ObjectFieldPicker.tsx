import { useEffect, useMemo, useState } from 'react';
import type {
  OrgIdentity,
  SalesforceObjectDescribe,
  SalesforceObjectSummary,
} from '@varkole/shared';
import { sendMessage } from '../api';
import {
  matchingObjectSuggestions,
  objectDisplayLabel,
  sortSalesforceObjects,
} from './object-suggestions';

export function ObjectFieldPicker({
  org,
  objectApiName,
  onObjectApiNameChange,
  selectedFields,
  onSelectedFieldsChange,
  onObjectsLoaded,
  onDescribeLoaded,
}: {
  org: OrgIdentity;
  objectApiName: string;
  onObjectApiNameChange: (name: string) => void;
  selectedFields: string[];
  onSelectedFieldsChange: (fields: string[]) => void;
  onObjectsLoaded?: ((objects: SalesforceObjectSummary[]) => void) | undefined;
  onDescribeLoaded?: ((describe: SalesforceObjectDescribe) => void) | undefined;
}) {
  const [objects, setObjects] = useState<SalesforceObjectSummary[]>([]);
  const [objectDraft, setObjectDraft] = useState<string>();
  const [describe, setDescribe] = useState<SalesforceObjectDescribe>();
  const [fieldFilter, setFieldFilter] = useState('');
  const [loadingObjects, setLoadingObjects] = useState(true);
  const [loadingFields, setLoadingFields] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    void sendMessage<SalesforceObjectSummary[]>({ type: 'GET_OBJECTS', payload: { key: org.key } })
      .then((next) => {
        if (active) {
          const sorted = sortSalesforceObjects(next);
          setObjects(sorted);
          onObjectsLoaded?.(sorted);
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load objects.');
      })
      .finally(() => {
        if (active) setLoadingObjects(false);
      });
    return () => {
      active = false;
    };
  }, [onObjectsLoaded, org.key]);

  useEffect(() => {
    let active = true;
    const exact = objects.find(
      (object) => object.name.toLowerCase() === objectApiName.trim().toLowerCase(),
    );
    if (!exact) return;
    const timer = window.setTimeout(() => {
      setLoadingFields(true);
      setError(undefined);
      void sendMessage<SalesforceObjectDescribe>({
        type: 'DESCRIBE_OBJECT',
        payload: { key: org.key, objectApiName: exact.name },
      })
        .then((next) => {
          if (active) {
            setDescribe(next);
            onDescribeLoaded?.(next);
          }
        })
        .catch(
          (cause: unknown) =>
            active && setError(cause instanceof Error ? cause.message : 'Could not load fields.'),
        )
        .finally(() => {
          if (active) setLoadingFields(false);
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [objectApiName, objects, onDescribeLoaded, org.key]);

  const activeDescribe =
    describe?.name.toLowerCase() === objectApiName.trim().toLowerCase() ? describe : undefined;
  const selectedObject = objects.find(
    (object) => object.name.toLowerCase() === objectApiName.trim().toLowerCase(),
  );
  const objectInput =
    objectDraft ?? (selectedObject ? objectDisplayLabel(selectedObject) : objectApiName);
  const objectSuggestions = useMemo(
    () => matchingObjectSuggestions(objects, objectDraft ?? ''),
    [objectDraft, objects],
  );

  const visibleFields = useMemo(() => {
    const needle = fieldFilter.trim().toLowerCase();
    return [...(activeDescribe?.fields ?? [])]
      .filter(
        (field) =>
          !needle ||
          field.name.toLowerCase().includes(needle) ||
          field.label.toLowerCase().includes(needle) ||
          field.type.toLowerCase().includes(needle),
      )
      .sort((left, right) =>
        (left.label || left.name).localeCompare(right.label || right.name, undefined, {
          sensitivity: 'base',
          numeric: true,
        }),
      )
      .slice(0, 100);
  }, [activeDescribe, fieldFilter]);

  function toggleField(name: string) {
    onSelectedFieldsChange(
      selectedFields.includes(name)
        ? selectedFields.filter((field) => field !== name)
        : [...selectedFields, name],
    );
  }

  return (
    <div className="schema-assistant">
      <div className="schema-assistant-header">
        <strong>Choose object and fields</strong>
        {loadingObjects && <span className="muted">Loading objects…</span>}
      </div>
      <div className="schema-controls">
        <label>
          <span>Object</span>
          <input
            list={`objects-${org.orgId}`}
            value={objectInput}
            onChange={(event) => {
              const value = event.target.value;
              const exact = objects.find(
                (object) =>
                  objectDisplayLabel(object).toLowerCase() === value.trim().toLowerCase() ||
                  object.name.toLowerCase() === value.trim().toLowerCase(),
              );
              if (exact) {
                setObjectDraft(undefined);
                onObjectApiNameChange(exact.name);
              } else {
                setObjectDraft(value);
                if (!value.trim()) onObjectApiNameChange('');
              }
            }}
            placeholder="Start typing object name"
            autoComplete="off"
          />
          <datalist id={`objects-${org.orgId}`}>
            {objectSuggestions.map((object) => (
              <option key={object.name} value={objectDisplayLabel(object)}>
                {object.name}
              </option>
            ))}
          </datalist>
          {objectDraft !== undefined && objectDraft.trim().length < 2 && (
            <small className="input-hint">Type at least 2 characters</small>
          )}
        </label>
        <label>
          <span>Fields</span>
          <input
            value={fieldFilter}
            onChange={(event) => setFieldFilter(event.target.value)}
            placeholder={activeDescribe ? 'Start typing field name' : 'Choose an object first'}
            disabled={!activeDescribe}
          />
        </label>
      </div>
      {error && <p className="schema-error">{error}</p>}
      {loadingFields ? (
        <p className="muted">Loading fields…</p>
      ) : activeDescribe ? (
        <div className="field-suggestions" aria-label={`${activeDescribe.label} field suggestions`}>
          {visibleFields.map((field) => (
            <button
              key={field.name}
              type="button"
              className={`field-chip ${selectedFields.includes(field.name) ? 'selected' : ''}`}
              onClick={() => toggleField(field.name)}
              title={`${field.label} · ${field.type}${field.custom ? ' · custom' : ''}`}
            >
              <span>{field.label}</span>
            </button>
          ))}
          {visibleFields.length === 0 && <span className="muted">No matching fields.</span>}
        </div>
      ) : (
        <p className="muted">Start typing an object name to see fields.</p>
      )}
    </div>
  );
}
