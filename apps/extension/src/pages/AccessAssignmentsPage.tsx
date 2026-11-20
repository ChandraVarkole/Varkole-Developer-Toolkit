import { useMemo, useState } from 'react';
import type { OrgIdentity, QueryPage } from '@varkole/shared';
import { QueryResults } from '../components/QueryResults';
import { EmptyState, InlineError } from '../components/Status';
import { useAutoLoad } from '../useAutoLoad';
import { ACCESS_ASSIGNMENT_COPYABLE_COLUMNS } from './access-assignments-config';
import { loadAllQueryPages } from './query-all-pages';

const ACCESS_QUERY =
  'SELECT Id, Assignee.Name, Assignee.Username, PermissionSet.Label, PermissionSet.Name, PermissionSet.IsOwnedByProfile FROM PermissionSetAssignment ORDER BY Assignee.Name, PermissionSet.Label';

export function AccessAssignmentsPage({ org }: { org?: OrgIdentity | undefined }) {
  const [result, setResult] = useState<QueryPage>();
  const [origin, setOrigin] = useState<'all' | 'profile' | 'permission-set'>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  async function load() {
    if (!org) return;
    setLoading(true);
    setError(undefined);
    try {
      setResult(
        await loadAllQueryPages({
          key: org.key,
          soql: ACCESS_QUERY,
          mode: 'rest',
          rowLimit: Number.MAX_SAFE_INTEGER,
        }),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Access assignments could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  useAutoLoad(load, org ? `${org.key}:access-assignments-all` : undefined);

  const filtered = useMemo(() => {
    if (!result) return undefined;
    const records = result.records.filter((record) => {
      const permission = record.PermissionSet;
      const data =
        permission && typeof permission === 'object'
          ? (permission as Record<string, unknown>)
          : undefined;
      const fromProfile = data?.IsOwnedByProfile === true;
      if (origin === 'profile' && !fromProfile) return false;
      if (origin === 'permission-set' && fromProfile) return false;
      return true;
    });
    return { ...result, totalSize: records.length, records };
  }, [origin, result]);

  if (!org) {
    return (
      <EmptyState
        title="Open a Salesforce org"
        description="Access assignments use the selected Salesforce browser session."
      />
    );
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <div className="eyebrow">Administration · read-only</div>
          <h1>Access Assignments</h1>
        </div>
        <button
          className="button button-primary"
          type="button"
          disabled={loading}
          onClick={() => void load()}
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </header>
      <InlineError message={error} />
      {filtered && (
        <>
          <section className="section-card compact-section assignment-filters">
            <label>
              <span>Show</span>
              <select
                value={origin}
                onChange={(event) => setOrigin(event.target.value as typeof origin)}
              >
                <option value="all">All assignments</option>
                <option value="profile">Profile assignments</option>
                <option value="permission-set">Permission set assignments</option>
              </select>
            </label>
          </section>
          <QueryResults
            result={filtered}
            pageNumber={1}
            modeLabel="REST"
            loading={loading}
            recordBaseUrl={org.instanceUrl}
            clientPageSize={200}
            filterPlaceholder="Search all access assignments…"
            expandTable
            columnLabels={{
              'Assignee.Name': 'Assignee',
              'Assignee.Username': 'Username',
              'PermissionSet.Label': 'Permission set',
              'PermissionSet.Name': 'API name',
              'PermissionSet.IsOwnedByProfile': 'From profile',
            }}
            copyableColumns={ACCESS_ASSIGNMENT_COPYABLE_COLUMNS}
          />
        </>
      )}
    </div>
  );
}
