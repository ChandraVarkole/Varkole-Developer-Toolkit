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
  objectSearchInputState,
  objectSelectionLabel,
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
  showFields = true,
  expandedFields = false,
  onToggleFields,
}: {
  org: OrgIdentity;
  objectApiName: string;
  onObjectApiNameChange: (name: string) => void;
  selectedFields: string[];
  onSelectedFieldsChange: (fields: string[]) => void;
  onObjectsLoaded?: ((objects: SalesforceObjectSummary[]) => void) | undefined;
  onDescribeLoaded?: ((describe: SalesforceObjectDescribe) => void) | undefined;
  showFields?: boolean | undefined;
  expandedFields?: boolean | undefined;
  onToggleFields?: (() => void) | undefined;
}) {
  const [objects, setObjects] = useState<SalesforceObjectSummary[]>([]);
  const [objectDraft, setObjectDraft] = useState<string>();
  const [describe, setDescribe] = useState<SalesforceObjectDescribe>();
  const [fieldFilter, setFieldFilter] = useState('');
  const [loadingObjects, setLoadingObjects] = useState(true);
  const [loadingFields, setLoadingFields] = useState(false);
  const [error, setError] = useState<string>();
  const [showObjectSuggestions, setShowObjectSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(0);

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
    objectDraft === undefined && describe?.name.toLowerCase() === objectApiName.trim().toLowerCase()
      ? describe
      : undefined;
  const selectedObject = objects.find(
    (object) => object.name.toLowerCase() === objectApiName.trim().toLowerCase(),
  );
  const objectInput =
    objectDraft ?? (selectedObject ? objectSelectionLabel(selectedObject, objects) : objectApiName);
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

  function chooseObject(object: SalesforceObjectSummary) {
    setObjectDraft(undefined);
    setShowObjectSuggestions(false);
    setActiveSuggestion(0);
    setFieldFilter('');
    onObjectApiNameChange(object.name);
  }

  return (
    <div className={`schema-assistant ${expandedFields ? 'expanded-fields' : ''}`}>
      <div className="schema-assistant-header">
        <strong>{showFields ? 'Choose object and fields' : 'Choose object'}</strong>
        <div className="schema-header-actions">
          {loadingObjects && <span className="muted">Loading objects…</span>}
          {onToggleFields && (
            <button
              className={`button button-compact field-visibility-toggle ${showFields ? 'is-visible' : 'is-hidden'}`}
              type="button"
              onClick={onToggleFields}
            >
              {showFields ? 'Hide fields' : 'Show fields'}
            </button>
          )}
        </div>
      </div>
      <div className={`schema-controls ${showFields ? '' : 'single'}`}>
        <label>
          <span>Object</span>
          <div className="object-combobox">
            <input
              value={objectInput}
              onFocus={(event) => {
                setShowObjectSuggestions((objectDraft?.trim().length ?? 0) >= 2);
                if (objectDraft === undefined && selectedObject) event.currentTarget.select();
              }}
              onBlur={() => window.setTimeout(() => setShowObjectSuggestions(false), 100)}
              onChange={(event) => {
                const next = objectSearchInputState(event.target.value);
                setObjectDraft(next.draft);
                setActiveSuggestion(0);
                setShowObjectSuggestions(next.showSuggestions);
                if (next.clearSelection) onObjectApiNameChange('');
              }}
              onKeyDown={(event) => {
                if (!showObjectSuggestions || objectSuggestions.length === 0) return;
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  setActiveSuggestion((current) => (current + 1) % objectSuggestions.length);
                } else if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  setActiveSuggestion(
                    (current) =>
                      (current - 1 + objectSuggestions.length) % objectSuggestions.length,
                  );
                } else if (event.key === 'Enter') {
                  event.preventDefault();
                  chooseObject(objectSuggestions[activeSuggestion] ?? objectSuggestions[0]!);
                } else if (event.key === 'Escape') {
                  setShowObjectSuggestions(false);
                }
              }}
              placeholder="Start typing object name"
              autoComplete="off"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={showObjectSuggestions && objectSuggestions.length > 0}
              aria-controls={`objects-${org.orgId}`}
            />
            {showObjectSuggestions && objectSuggestions.length > 0 && (
              <div className="object-suggestion-list" id={`objects-${org.orgId}`} role="listbox">
                {objectSuggestions.map((object, index) => (
                  <button
                    key={object.name}
                    type="button"
                    role="option"
                    aria-selected={index === activeSuggestion}
                    className={index === activeSuggestion ? 'active' : ''}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActiveSuggestion(index)}
                    onClick={() => chooseObject(object)}
                  >
                    <span>{objectDisplayLabel(object)}</span>
                    <code>{object.name}</code>
                    <small>{object.custom ? 'Custom' : 'Standard'}</small>
                  </button>
                ))}
              </div>
            )}
          </div>
          {objectDraft !== undefined && objectDraft.trim().length < 2 && (
            <small className="input-hint">Type at least 2 characters</small>
          )}
        </label>
        {showFields && (
          <label>
            <span>Fields</span>
            <input
              value={fieldFilter}
              onChange={(event) => setFieldFilter(event.target.value)}
              placeholder={activeDescribe ? 'Start typing field name' : 'Choose an object first'}
              disabled={!activeDescribe}
            />
          </label>
        )}
      </div>
      {error && <p className="schema-error">{error}</p>}
      {!showFields ? null : loadingFields ? (
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
