import { useMemo, useRef, useState } from 'react';
import type {
  OrgIdentity,
  QueryPage,
  QueryRecord,
  SalesforceObjectDescribe,
} from '@varkole/shared';
import { sendMessage } from '../api';
import { EmptyState, InlineError } from '../components/Status';
import { useAutoLoad } from '../useAutoLoad';
import {
  buildPermissionSnapshot,
  comparePermissionSnapshots,
  matchingPermissionSources,
  permissionSourcesFromRecords,
  systemPermissionFieldNames,
  type PermissionCategory,
  type PermissionQueryResults,
  type PermissionSnapshot,
  type PermissionSource,
  type PermissionSourceKind,
} from './permission-comparator';

const SOURCE_QUERY =
  'SELECT Id, Name, Label, IsOwnedByProfile, ProfileId, Profile.Name FROM PermissionSet ORDER BY IsOwnedByProfile DESC, Label ASC LIMIT 2000';
const MAX_COMPARISON_ROWS = 10_000;
const SYSTEM_PERMISSION_QUERY_SIZE = 75;

type ComparisonMode = 'permission-sets' | 'profiles' | 'mixed';

const COMPARISON_MODES: Record<
  ComparisonMode,
  { label: string; leftKind: PermissionSourceKind; rightKind: PermissionSourceKind; hint: string }
> = {
  'permission-sets': {
    label: 'Permission Set vs Permission Set',
    leftKind: 'permission-set',
    rightKind: 'permission-set',
    hint: 'Compare two standalone Permission Sets.',
  },
  profiles: {
    label: 'Profile vs Profile',
    leftKind: 'profile',
    rightKind: 'profile',
    hint: 'Compare the Permission Set records that Salesforce owns for two Profiles.',
  },
  mixed: {
    label: 'Profile vs Permission Set',
    leftKind: 'profile',
    rightKind: 'permission-set',
    hint: 'Compare a Profile baseline with a standalone Permission Set.',
  },
};

export function PermissionComparatorPage({ org }: { org?: OrgIdentity | undefined }) {
  const [sources, setSources] = useState<PermissionSource[]>([]);
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('permission-sets');
  const [leftId, setLeftId] = useState('');
  const [rightId, setRightId] = useState('');
  const [leftSnapshot, setLeftSnapshot] = useState<PermissionSnapshot>();
  const [rightSnapshot, setRightSnapshot] = useState<PermissionSnapshot>();
  const [loadingSources, setLoadingSources] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState<string>();
  const [filter, setFilter] = useState('');
  const [category, setCategory] = useState<'All' | PermissionCategory>('All');
  const [differencesOnly, setDifferencesOnly] = useState(true);
  const [pickerResetKey, setPickerResetKey] = useState(0);
  const comparisonGeneration = useRef(0);

  async function loadSources() {
    if (!org) return;
    setLoadingSources(true);
    setError(undefined);
    try {
      const records = await runAllPages(org, SOURCE_QUERY);
      setSources(permissionSourcesFromRecords(records));
    } catch (cause) {
      setError(message(cause));
    } finally {
      setLoadingSources(false);
    }
  }

  useAutoLoad(loadSources, org ? `${org.key}:permission-comparator` : undefined);

  async function compare() {
    if (!org) return;
    const left = sources.find((source) => source.id === leftId);
    const right = sources.find((source) => source.id === rightId);
    if (!left || !right) {
      setError('Choose two Profiles or Permission Sets to compare.');
      return;
    }
    if (left.id === right.id) {
      setError('Choose two different permission sources.');
      return;
    }

    const generation = comparisonGeneration.current + 1;
    comparisonGeneration.current = generation;
    setComparing(true);
    setError(undefined);
    setLeftSnapshot(undefined);
    setRightSnapshot(undefined);
    try {
      let systemFields: string[] = [];
      let systemDescribeUnavailable = false;
      try {
        const describe = await sendMessage<SalesforceObjectDescribe>({
          type: 'DESCRIBE_OBJECT',
          payload: { key: org.key, objectApiName: 'PermissionSet' },
        });
        systemFields = systemPermissionFieldNames(describe);
      } catch {
        systemDescribeUnavailable = true;
      }

      const [leftLoaded, rightLoaded] = await Promise.all([
        loadSnapshot(org, left, systemFields, systemDescribeUnavailable),
        loadSnapshot(org, right, systemFields, systemDescribeUnavailable),
      ]);
      if (comparisonGeneration.current === generation) {
        setLeftSnapshot(leftLoaded);
        setRightSnapshot(rightLoaded);
      }
    } catch (cause) {
      setError(message(cause));
    } finally {
      setComparing(false);
    }
  }

  const comparison = useMemo(
    () =>
      leftSnapshot && rightSnapshot ? comparePermissionSnapshots(leftSnapshot, rightSnapshot) : [],
    [leftSnapshot, rightSnapshot],
  );
  const categories = useMemo(
    () => [...new Set(comparison.map((entry) => entry.category))],
    [comparison],
  );
  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    return comparison.filter(
      (entry) =>
        (!differencesOnly || entry.differs) &&
        (category === 'All' || entry.category === category) &&
        (!needle ||
          `${entry.category} ${entry.label} ${entry.left} ${entry.right}`
            .toLowerCase()
            .includes(needle)),
    );
  }, [category, comparison, differencesOnly, filter]);
  const differentCount = comparison.filter((entry) => entry.differs).length;
  const mode = COMPARISON_MODES[comparisonMode];

  function changeComparisonMode(nextMode: ComparisonMode) {
    comparisonGeneration.current += 1;
    setComparisonMode(nextMode);
    setLeftId('');
    setRightId('');
    setLeftSnapshot(undefined);
    setRightSnapshot(undefined);
    setError(undefined);
    setFilter('');
    setCategory('All');
    setDifferencesOnly(true);
    setPickerResetKey((key) => key + 1);
  }

  async function refreshChoices() {
    comparisonGeneration.current += 1;
    setComparisonMode('permission-sets');
    setLeftId('');
    setRightId('');
    setLeftSnapshot(undefined);
    setRightSnapshot(undefined);
    setError(undefined);
    setFilter('');
    setCategory('All');
    setDifferencesOnly(true);
    setSources([]);
    setPickerResetKey((key) => key + 1);
    await loadSources();
  }

  if (!org) {
    return (
      <EmptyState
        title="Open a Salesforce org"
        description="Permission Comparison uses the selected Salesforce browser session."
      />
    );
  }

  return (
    <div className="page-stack permission-comparator-page">
      <header className="page-header">
        <div>
          <div className="eyebrow">Access analysis · read-only</div>
          <h1>Permission Comparison</h1>
          <p>Compare configured Salesforce access using live data from the selected org.</p>
        </div>
        <button
          className="button button-secondary button-compact"
          type="button"
          disabled={loadingSources}
          onClick={() => void refreshChoices()}
        >
          {loadingSources ? 'Loading…' : 'Refresh choices'}
        </button>
      </header>

      <InlineError message={error} />

      <section className="section-card permission-picker-card">
        <div className="permission-mode-row">
          <label className="permission-mode-select">
            <span>Comparison type</span>
            <select
              value={comparisonMode}
              onChange={(event) => changeComparisonMode(event.target.value as ComparisonMode)}
            >
              {Object.entries(COMPARISON_MODES).map(([value, option]) => (
                <option key={value} value={value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <p>{mode.hint}</p>
        </div>
        <div className="permission-picker-grid">
          <PermissionSourceSearch
            key={`left:${comparisonMode}:${pickerResetKey}`}
            id="permission-left"
            label={mode.leftKind === 'profile' ? 'First Profile' : 'First Permission Set'}
            value={leftId}
            kind={mode.leftKind}
            sources={sources}
            onChange={setLeftId}
          />
          <span className="permission-versus" aria-hidden="true">
            vs
          </span>
          <PermissionSourceSearch
            key={`right:${comparisonMode}:${pickerResetKey}`}
            id="permission-right"
            label={mode.rightKind === 'profile' ? 'Second Profile' : 'Second Permission Set'}
            value={rightId}
            kind={mode.rightKind}
            sources={sources}
            onChange={setRightId}
          />
          <button
            className="button button-primary"
            type="button"
            disabled={comparing || loadingSources || !leftId || !rightId}
            onClick={() => void compare()}
          >
            {comparing ? 'Comparing…' : 'Compare permissions'}
          </button>
        </div>
      </section>

      {leftSnapshot && rightSnapshot && (
        <>
          <section className="permission-summary" aria-label="Comparison summary">
            <div>
              <strong>{comparison.length.toLocaleString()}</strong>
              <span>Compared entries</span>
            </div>
            <div>
              <strong>{differentCount.toLocaleString()}</strong>
              <span>Differences</span>
            </div>
            <div>
              <strong>{leftSnapshot.source.label}</strong>
              <span>{sourceKind(leftSnapshot.source)}</span>
            </div>
            <div>
              <strong>{rightSnapshot.source.label}</strong>
              <span>{sourceKind(rightSnapshot.source)}</span>
            </div>
          </section>

          {(leftSnapshot.unavailable.length > 0 || rightSnapshot.unavailable.length > 0) && (
            <section className="comparison-limits" role="note">
              <strong>Some categories could not be inspected</strong>
              <p>
                Salesforce access varies by org and user. Unavailable for the first selection:{' '}
                {leftSnapshot.unavailable.join(', ') || 'none'}. Unavailable for the second:{' '}
                {rightSnapshot.unavailable.join(', ') || 'none'}.
              </p>
            </section>
          )}

          <section className="results-card permission-results" aria-label="Permission differences">
            <div className="permission-results-toolbar">
              <label>
                <span className="sr-only">Permission category</span>
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value as typeof category)}
                >
                  <option value="All">All categories</option>
                  {categories.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label className="comparison-differences-toggle">
                <input
                  type="checkbox"
                  checked={differencesOnly}
                  onChange={(event) => setDifferencesOnly(event.target.checked)}
                />
                Differences only
              </label>
              <label className="result-filter">
                <span className="sr-only">Filter permissions</span>
                <input
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                  placeholder="Filter permissions…"
                />
              </label>
            </div>
            <div className="table-scroll permission-comparison-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Permission</th>
                    <th>{leftSnapshot.source.label}</th>
                    <th>{rightSnapshot.source.label}</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((entry) => (
                    <tr
                      key={`${entry.category}:${entry.key}`}
                      className={entry.differs ? 'permission-difference' : ''}
                    >
                      <td>{entry.category}</td>
                      <td title={entry.key}>
                        <strong>{entry.label}</strong>
                      </td>
                      <td>{entry.left}</td>
                      <td>{entry.right}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {visible.length === 0 && (
                <div className="empty-results">
                  <strong>No matching differences</strong>
                  <p>Change the category, filter, or show matching permissions.</p>
                </div>
              )}
            </div>
            <div className="results-footer">
              Showing {visible.length.toLocaleString()} of {comparison.length.toLocaleString()}{' '}
              entries
            </div>
          </section>

          <p className="permission-effective-note">
            This compares configured permissions. Record sharing, restriction rules, permission-set
            group muting, licenses, and other runtime controls can still change effective access.
          </p>
        </>
      )}
    </div>
  );
}

function PermissionSourceSearch({
  id,
  label,
  value,
  kind,
  sources,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  kind: PermissionSourceKind;
  sources: PermissionSource[];
  onChange: (value: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const selected = sources.find((source) => source.id === value);
  const matches = matchingPermissionSources(sources, query, kind);

  function choose(source: PermissionSource) {
    onChange(source.id);
    setQuery(source.label);
    setOpen(false);
    setActiveIndex(0);
  }

  return (
    <label className="permission-source-search" htmlFor={id}>
      <span>{label}</span>
      <div className="permission-search-combobox">
        <input
          id={id}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open && query.trim().length >= 2}
          aria-controls={`${id}-options`}
          autoComplete="off"
          value={query}
          placeholder={`Start typing ${kind === 'profile' ? 'Profile' : 'Permission Set'} name`}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onChange={(event) => {
            setQuery(event.target.value);
            onChange('');
            setOpen(true);
            setActiveIndex(0);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setOpen(false);
              return;
            }
            if (!matches.length) return;
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((index) => Math.min(index + 1, matches.length - 1));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActiveIndex((index) => Math.max(index - 1, 0));
            } else if (event.key === 'Enter' && open) {
              event.preventDefault();
              const match = matches[activeIndex] ?? matches[0];
              if (match) choose(match);
            }
          }}
        />
        {open && query.trim().length >= 2 && (
          <div id={`${id}-options`} className="permission-suggestion-list" role="listbox">
            {matches.length ? (
              matches.map((source, index) => (
                <button
                  key={source.id}
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  className={index === activeIndex ? 'is-active' : ''}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => choose(source)}
                >
                  <span>
                    <strong>{source.label}</strong>
                    <small>{source.apiName}</small>
                  </span>
                  <em>{sourceKind(source)}</em>
                </button>
              ))
            ) : (
              <p>No matching {kind === 'profile' ? 'Profiles' : 'Permission Sets'}.</p>
            )}
          </div>
        )}
      </div>
      {selected && <small className="permission-selected-source">{selected.apiName}</small>}
    </label>
  );
}

async function loadSnapshot(
  org: OrgIdentity,
  source: PermissionSource,
  systemFields: string[],
  systemDescribeUnavailable: boolean,
): Promise<PermissionSnapshot> {
  if (!/^[A-Za-z0-9]{15}(?:[A-Za-z0-9]{3})?$/.test(source.id)) {
    throw new Error('Salesforce returned an invalid Permission Set identifier.');
  }
  const escapedId = source.id;
  const queries: Array<[keyof PermissionQueryResults, string, string]> = [
    [
      'objects',
      `SELECT SObjectType, PermissionsRead, PermissionsCreate, PermissionsEdit, PermissionsDelete, PermissionsViewAllRecords, PermissionsModifyAllRecords FROM ObjectPermissions WHERE ParentId = '${escapedId}' ORDER BY SObjectType LIMIT 2000`,
      'Object permissions',
    ],
    [
      'fields',
      `SELECT SObjectType, Field, PermissionsRead, PermissionsEdit FROM FieldPermissions WHERE ParentId = '${escapedId}' ORDER BY SObjectType, Field LIMIT 5000`,
      'Field permissions',
    ],
    [
      'apexClasses',
      `SELECT ApexClass.Name FROM ApexClassAccess WHERE ParentId = '${escapedId}' ORDER BY ApexClass.Name LIMIT 2000`,
      'Apex class access',
    ],
    [
      'visualforcePages',
      `SELECT ApexPage.Name FROM ApexPageAccess WHERE ParentId = '${escapedId}' ORDER BY ApexPage.Name LIMIT 2000`,
      'Visualforce page access',
    ],
    [
      'tabs',
      `SELECT Name, Visibility FROM PermissionSetTabSetting WHERE ParentId = '${escapedId}' ORDER BY Name LIMIT 2000`,
      'Tab visibility',
    ],
  ];
  const settled = await Promise.all(
    queries.map(async ([key, soql, label]) => {
      try {
        return { key, records: await runAllPages(org, soql), label };
      } catch {
        return { key, records: undefined, label };
      }
    }),
  );
  const results: PermissionQueryResults = {};
  const unavailable =
    systemDescribeUnavailable || systemFields.length === 0 ? ['System permissions'] : [];
  for (const item of settled) {
    if (item.records) results[item.key] = item.records;
    else unavailable.push(item.label);
  }

  if (!systemDescribeUnavailable && systemFields.length > 0) {
    const chunks = Array.from(
      { length: Math.ceil(systemFields.length / SYSTEM_PERMISSION_QUERY_SIZE) },
      (_, index) =>
        systemFields.slice(
          index * SYSTEM_PERMISSION_QUERY_SIZE,
          (index + 1) * SYSTEM_PERMISSION_QUERY_SIZE,
        ),
    );
    const systemPages = await Promise.allSettled(
      chunks.map((fields) =>
        runAllPages(
          org,
          `SELECT ${fields.join(', ')} FROM PermissionSet WHERE Id = '${escapedId}' LIMIT 1`,
        ),
      ),
    );
    if (systemPages.every((page) => page.status === 'fulfilled')) {
      const mergedSystemPermissions = systemPages.reduce<QueryRecord>((merged, page) => {
        const values = page.status === 'fulfilled' ? page.value[0] : undefined;
        return values ? { ...merged, ...values } : merged;
      }, {});
      results.system = [mergedSystemPermissions];
    } else {
      unavailable.push('System permissions');
    }
  }
  return buildPermissionSnapshot(source, systemFields, results, unavailable);
}

async function runAllPages(org: OrgIdentity, soql: string): Promise<QueryRecord[]> {
  let page = await sendMessage<QueryPage>({
    type: 'RUN_QUERY',
    payload: { key: org.key, soql, mode: 'rest', requestId: crypto.randomUUID() },
  });
  const records = [...page.records];
  while (page.nextRecordsUrl && records.length < MAX_COMPARISON_ROWS) {
    page = await sendMessage<QueryPage>({
      type: 'QUERY_NEXT',
      payload: {
        key: org.key,
        nextRecordsUrl: page.nextRecordsUrl,
        mode: 'rest',
        requestId: crypto.randomUUID(),
      },
    });
    records.push(...page.records);
  }
  return records.slice(0, MAX_COMPARISON_ROWS);
}

function sourceKind(source: PermissionSource): string {
  return source.kind === 'profile' ? 'Profile' : 'Permission Set';
}

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Salesforce could not compare these permissions.';
}
