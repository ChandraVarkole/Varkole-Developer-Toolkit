import type { OrgIdentity } from '@varkole/shared';

export function EnvironmentBadge({ org }: { org: OrgIdentity }) {
  return (
    <span className={`badge ${org.environment === 'production' ? 'badge-danger' : 'badge-safe'}`}>
      <span className="badge-dot" />
      {org.environment === 'production' ? 'Production' : 'Sandbox'}
    </span>
  );
}

export function InlineError({ message }: { message?: string | undefined }) {
  if (!message) return null;
  return (
    <div className="alert alert-error" role="alert">
      <span aria-hidden="true">!</span>
      <div>
        <strong>Something needs attention</strong>
        <p>{message}</p>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon" aria-hidden="true">
        ◇
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </div>
  );
}
