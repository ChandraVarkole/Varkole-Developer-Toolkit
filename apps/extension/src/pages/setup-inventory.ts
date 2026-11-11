import type { QueryPage, QueryRecord } from '@varkole/shared';

export function formatInstalledPackages(result: QueryPage): QueryPage {
  return {
    ...result,
    records: result.records
      .map((record) => {
        const packageInfo = nestedRecord(record, 'SubscriberPackage');
        const version = nestedRecord(record, 'SubscriberPackageVersion');
        const managed = version.IsManaged === true;
        const versionNumber = [
          version.MajorVersion,
          version.MinorVersion,
          version.PatchVersion,
          version.BuildNumber,
        ]
          .map((part) =>
            typeof part === 'number' || typeof part === 'string' ? String(part) : '0',
          )
          .join('.');

        return {
          Package: text(packageInfo.Name) || text(version.Name) || 'Unnamed package',
          Namespace: text(packageInfo.NamespacePrefix) || 'None',
          Type: managed ? 'Managed' : 'Unmanaged',
          Version: versionNumber,
          VersionName: text(version.Name),
          Release: text(version.ReleaseState) || 'Unknown',
          Status: version.IsDeprecated === true ? 'Deprecated' : 'Installed',
        };
      })
      .sort((left, right) => compareNames(left.Package, right.Package)),
  };
}

export function formatFlows(result: QueryPage): QueryPage {
  return {
    ...result,
    records: result.records
      .map((record) => {
        const namespace = text(record.NamespacePrefix);
        const manageableState = text(record.ManageableState);
        return {
          Name: text(record.MasterLabel) || text(record.DeveloperName) || 'Unnamed flow',
          ApiName: text(record.DeveloperName),
          Namespace: namespace || 'None',
          Type:
            namespace || /^(installed|released|beta|deprecated)/i.test(manageableState)
              ? 'Managed'
              : 'Unmanaged',
          Status: text(record.ActiveVersionId) ? 'Active' : 'Inactive',
        };
      })
      .sort((left, right) => compareNames(left.Name, right.Name)),
  };
}

export function packageStateLabel(value: unknown, namespace?: unknown): string {
  const state = text(value);
  if (/unmanaged/i.test(state)) return 'Unmanaged';
  if (/installed|released|beta|deprecated/i.test(state) || text(namespace)) return 'Managed';
  return state || 'Local';
}

function nestedRecord(record: QueryRecord, key: string): Record<string, unknown> {
  const value = record[key];
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function compareNames(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: 'base', numeric: true });
}
