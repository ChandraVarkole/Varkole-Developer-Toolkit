import { useMemo, useState } from 'react';
import type { OrgIdentity, QueryPage } from '@varkole/shared';
import { QueryResults } from '../components/QueryResults';
import { EmptyState, InlineError } from '../components/Status';
import { useAutoLoad } from '../useAutoLoad';
import { loadAllQueryPages } from './query-all-pages';
import { mergeLoginUsernames } from './users-logins';

type UserView = 'all' | 'active' | 'inactive';
type Section = 'users' | 'logins';

const USER_QUERY =
  'SELECT Id, Name, Username, Email, IsActive, UserType, Profile.Name, TimeZoneSidKey, LastLoginDate FROM User ORDER BY Name';
const LOGIN_QUERY =
  'SELECT UserId, LoginTime, SourceIp, LoginType, LoginSubType, Status, Application, LoginUrl, LoginGeo.City, LoginGeo.Subdivision, LoginGeo.Country FROM LoginHistory ORDER BY LoginTime DESC';
const LOGIN_QUERY_FALLBACK =
  'SELECT UserId, LoginTime, SourceIp, LoginType, LoginSubType, Status, Application, LoginUrl, CountryIso FROM LoginHistory ORDER BY LoginTime DESC';

export function UsersLoginsPage({ org }: { org?: OrgIdentity | undefined }) {
  const [section, setSection] = useState<Section>('users');
  const [view, setView] = useState<UserView>('all');
  const [users, setUsers] = useState<QueryPage>();
  const [logins, setLogins] = useState<QueryPage>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  async function loadUsers() {
    if (!org) return;
    setLoading(true);
    setError(undefined);
    try {
      setUsers(
        await loadAllQueryPages({
          key: org.key,
          soql: USER_QUERY,
          mode: 'rest',
          rowLimit: Number.MAX_SAFE_INTEGER,
        }),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Users could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  async function loadLogins() {
    if (!org) return;
    setSection('logins');
    setLoading(true);
    setError(undefined);
    try {
      let result: QueryPage;
      try {
        result = await loadAllQueryPages({
          key: org.key,
          soql: LOGIN_QUERY,
          mode: 'rest',
          rowLimit: Number.MAX_SAFE_INTEGER,
        });
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        if (!/LoginGeo/i.test(message)) throw cause;
        result = await loadAllQueryPages({
          key: org.key,
          soql: LOGIN_QUERY_FALLBACK,
          mode: 'rest',
          rowLimit: Number.MAX_SAFE_INTEGER,
        });
      }
      const availableUsers =
        users ??
        (await loadAllQueryPages({
          key: org.key,
          soql: USER_QUERY,
          mode: 'rest',
          rowLimit: Number.MAX_SAFE_INTEGER,
        }));
      if (!users) setUsers(availableUsers);
      const records = mergeLoginUsernames(result.records, availableUsers.records);
      setLogins({ ...result, totalSize: records.length, records });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Login history could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  useAutoLoad(loadUsers, org ? `${org.key}:users-logins` : undefined);

  const visibleUsers = useMemo(() => {
    if (!users) return undefined;
    const records = users.records.filter((record) => {
      if (view === 'active') return record.IsActive === true;
      if (view === 'inactive') return record.IsActive === false;
      return true;
    });
    return { ...users, totalSize: records.length, records };
  }, [users, view]);

  if (!org) {
    return (
      <EmptyState
        title="Open a Salesforce org"
        description="Users and login history use the selected Salesforce browser session."
      />
    );
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <div className="eyebrow">Administration · read-only</div>
          <h1>Users / Logins</h1>
        </div>
        <div className="page-header-actions">
          <button
            className={`button ${section === 'users' ? 'button-primary' : 'button-secondary'}`}
            type="button"
            onClick={() => setSection('users')}
          >
            Users
          </button>
          <button
            className={`button ${section === 'logins' ? 'button-primary' : 'button-secondary'}`}
            type="button"
            disabled={loading}
            onClick={() => void (logins ? setSection('logins') : loadLogins())}
          >
            Login History
          </button>
          <button
            className="button button-secondary"
            type="button"
            disabled={loading}
            onClick={() => void (section === 'users' ? loadUsers() : loadLogins())}
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </header>

      <InlineError message={error} />

      {section === 'users' && visibleUsers && (
        <>
          <div className="segmented-control" role="group" aria-label="User list view">
            {(['all', 'active', 'inactive'] as const).map((item) => (
              <button
                key={item}
                className={view === item ? 'active' : ''}
                type="button"
                onClick={() => setView(item)}
              >
                {item === 'all'
                  ? 'All Users'
                  : item === 'active'
                    ? 'Active Users'
                    : 'Inactive Users'}
              </button>
            ))}
          </div>
          <QueryResults
            result={visibleUsers}
            pageNumber={1}
            modeLabel="REST"
            loading={loading}
            recordBaseUrl={org.instanceUrl}
            clientPageSize={200}
            filterPlaceholder="Search all users…"
            expandTable
            columnLabels={{
              Name: 'Name',
              Username: 'Username',
              Email: 'Email',
              IsActive: 'Active',
              UserType: 'User type',
              'Profile.Name': 'Profile',
              TimeZoneSidKey: 'Time zone',
              LastLoginDate: 'Last login',
            }}
            copyableColumns={['Username']}
          />
        </>
      )}

      {section === 'logins' && logins && (
        <QueryResults
          result={logins}
          pageNumber={1}
          modeLabel="REST"
          loading={loading}
          clientPageSize={200}
          filterPlaceholder="Search all login history…"
          expandTable
          columnLabels={{
            Username: 'Username',
            LoginTime: 'Login Time',
            SourceIp: 'Source IP',
            LoginType: 'Login Type',
            LoginSubType: 'Login Subtype',
            Status: 'Status',
            Application: 'Application',
            LoginUrl: 'Login URL',
            Location: 'Location',
          }}
        />
      )}
    </div>
  );
}
