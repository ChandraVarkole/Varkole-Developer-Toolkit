import { useEffect, useState } from 'react';
import type { OrgIdentity, OrgInfo, OrgLicenseUsage } from '@varkole/shared';
import { sendMessage } from '../api';
import { CopyButton } from '../components/CopyButton';
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
            <Detail label="Organization ID" value={info.id} mono copyable />
            <Detail label="Instance" value={info.instanceName ?? 'Not returned'} />
            <Detail label="Salesforce release" value={info.releaseName ?? 'Not returned'} />
            <Detail
              label="Latest API version"
              value={info.latestApiVersion ? `v${info.latestApiVersion}` : 'Not returned'}
            />
            <Detail label="Signed in as" value={info.displayName} />
            <Detail label="Username" value={info.username} mono copyable />
            <Detail label="Instance URL" value={info.instanceUrl} mono copyable />
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

          <LicenseUsageSection licenses={info.licenseUsage} />
        </>
      )}
    </div>
  );
}

function LicenseUsageSection({ licenses }: { licenses?: OrgLicenseUsage[] | undefined }) {
  return (
    <section className="section-card license-usage-section" aria-labelledby="license-usage-title">
      <div className="section-title">
        <div>
          <h2 id="license-usage-title">License usage</h2>
          <p>Salesforce user licenses assigned to active users.</p>
        </div>
      </div>
      {licenses === undefined ? (
        <p className="muted">
          License usage is unavailable for this user. Salesforce requires View Setup and
          Configuration access.
        </p>
      ) : licenses.length === 0 ? (
        <p className="muted">Salesforce returned no user-license records.</p>
      ) : (
        <div className="license-table-scroll">
          <table className="license-table">
            <thead>
              <tr>
                <th>License</th>
                <th>Status</th>
                <th>Used</th>
                <th>Available</th>
                <th>Total</th>
                <th>Usage</th>
              </tr>
            </thead>
            <tbody>
              {licenses.map((license, index) => {
                const available = availableLicenses(license);
                const percent = licensePercent(license);
                return (
                  <tr key={`${license.name}:${license.status}:${index}`}>
                    <td>
                      <strong>{license.name}</strong>
                    </td>
                    <td>
                      <span
                        className={`license-status ${license.status.toLowerCase() === 'active' ? 'active' : ''}`}
                      >
                        {license.status}
                      </span>
                    </td>
                    <td title={license.lastUpdated ? `Updated ${license.lastUpdated}` : undefined}>
                      {formatLicenseCount(license.usedLicenses)}
                    </td>
                    <td>{formatLicenseCount(available)}</td>
                    <td>{formatLicenseCount(license.totalLicenses)}</td>
                    <td>
                      {percent === undefined ? (
                        <span className="muted">Not available</span>
                      ) : (
                        <div
                          className="license-progress"
                          role="progressbar"
                          aria-label={`${license.name} license usage`}
                          aria-valuenow={percent}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        >
                          <span style={{ width: `${percent}%` }} />
                          <small>{percent.toFixed(0)}%</small>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function availableLicenses(license: OrgLicenseUsage): number | null {
  if (
    license.totalLicenses === null ||
    license.usedLicenses === null ||
    license.totalLicenses < 0
  ) {
    return null;
  }
  return Math.max(0, license.totalLicenses - license.usedLicenses);
}

function licensePercent(license: OrgLicenseUsage): number | undefined {
  if (
    license.totalLicenses === null ||
    license.usedLicenses === null ||
    license.totalLicenses <= 0
  ) {
    return undefined;
  }
  return Math.min(100, Math.max(0, (license.usedLicenses / license.totalLicenses) * 100));
}

function formatLicenseCount(value: number | null): string {
  return value === null ? 'Not returned' : value.toLocaleString();
}

function Detail({
  label,
  value,
  mono = false,
  copyable = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copyable?: boolean;
}) {
  return (
    <div className="detail">
      <span>{label}</span>
      <div className="detail-copy-row">
        <strong className={mono ? 'mono' : ''}>{value}</strong>
        {copyable && <CopyButton value={value} label={`Copy ${label}`} compact />}
      </div>
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
