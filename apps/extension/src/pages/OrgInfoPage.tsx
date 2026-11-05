import { useEffect, useState } from 'react';
import type { OrgIdentity, OrgInfo } from '@varkole/shared';
import { sendMessage } from '../api';
import { EmptyState, InlineError } from '../components/Status';

export function OrgInfoPage({ org }: { org?: OrgIdentity | undefined }) {
  const [info, setInfo] = useState<OrgInfo>();
  const [loading, setLoading] = useState(Boolean(org));
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!org) return;
    void sendMessage<OrgInfo>({ type: 'GET_ORG_INFO', payload: { key: org.key } })
      .then(setInfo)
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : 'Could not load org details.'),
      )
      .finally(() => setLoading(false));
  }, [org]);

  if (!org) {
    return (
      <EmptyState
        title="Connect an org"
        description="Org Info appears after a secure Salesforce connection."
      />
    );
  }
  if (loading) return <OrgInfoSkeleton />;

  const limits = info ? importantLimits(info.limits) : [];
  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <div className="eyebrow">Connected organization</div>
          <h1>Org Info</h1>
        </div>
        <button className="button button-secondary" type="button" onClick={() => location.reload()}>
          Refresh
        </button>
      </header>
      <InlineError message={error} />
      {info && (
        <>
          <section className="hero-card">
            <div className="org-monogram">{info.name.slice(0, 2).toUpperCase()}</div>
            <div>
              <span className="badge badge-outline">
                {info.isSandbox ? 'Sandbox' : 'Production'}
              </span>
              <h2>{info.name}</h2>
              <p>{info.organizationType}</p>
            </div>
            <div className="hero-card-aside">
              <small>API version</small>
              <strong>v{info.apiVersion}</strong>
            </div>
          </section>

          <section className="detail-grid" aria-label="Organization details">
            <Detail label="Organization ID" value={info.id} mono />
            <Detail label="Instance" value={info.instanceName ?? 'Not returned'} />
            <Detail label="Signed in as" value={info.displayName} />
            <Detail label="Username" value={info.username} mono />
            <Detail label="Instance URL" value={info.instanceUrl} mono />
            <Detail
              label="Fiscal year starts"
              value={
                info.fiscalYearStartMonth ? monthName(info.fiscalYearStartMonth) : 'Not returned'
              }
            />
          </section>

          <section className="section-card">
            <div className="section-title">
              <div>
                <h2>Platform limits</h2>
              </div>
              {info.apiUsage && <span className="subtle-code">{info.apiUsage}</span>}
            </div>
            {limits.length ? (
              <div className="limits-grid">
                {limits.map(([name, limit]) => {
                  const used = Math.max(0, limit.Max - limit.Remaining);
                  const percent = limit.Max ? Math.min(100, (used / limit.Max) * 100) : 0;
                  return (
                    <div className="limit" key={name}>
                      <div>
                        <strong>{formatLimitName(name)}</strong>
                        <span>{limit.Remaining.toLocaleString()} remaining</span>
                      </div>
                      <div
                        className="progress"
                        role="progressbar"
                        aria-valuenow={percent}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <span style={{ width: `${percent}%` }} />
                      </div>
                      <small>
                        {used.toLocaleString()} of {limit.Max.toLocaleString()} used
                      </small>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="muted">Limits are unavailable for this user or org.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="detail">
      <span>{label}</span>
      <strong className={mono ? 'mono' : ''}>{value}</strong>
    </div>
  );
}

function importantLimits(limits: OrgInfo['limits']) {
  const preferred = [
    'DailyApiRequests',
    'DataStorageMB',
    'FileStorageMB',
    'DailyBulkApiRequests',
    'ConcurrentAsyncGetReportInstances',
  ];
  return preferred.filter((key) => limits[key]).map((key) => [key, limits[key]!] as const);
}

function formatLimitName(value: string) {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/MB$/, ' (MB)');
}

function monthName(month: number) {
  return new Intl.DateTimeFormat(undefined, { month: 'long' }).format(new Date(2024, month - 1, 1));
}

function OrgInfoSkeleton() {
  return (
    <div className="page-stack" aria-label="Loading org information">
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-hero" />
      <div className="detail-grid">
        {Array.from({ length: 6 }, (_, index) => (
          <div className="skeleton skeleton-detail" key={index} />
        ))}
      </div>
    </div>
  );
}
