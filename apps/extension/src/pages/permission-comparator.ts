import type {
  QueryRecord,
  SalesforceFieldSummary,
  SalesforceObjectDescribe,
} from '@varkole/shared';

export type PermissionSourceKind = 'profile' | 'permission-set';

export interface PermissionSource {
  id: string;
  kind: PermissionSourceKind;
  label: string;
  apiName: string;
}

export interface PermissionGrant {
  key: string;
  label: string;
  value: string;
}

export interface PermissionSnapshot {
  source: PermissionSource;
  system: PermissionGrant[];
  objects: PermissionGrant[];
  fields: PermissionGrant[];
  apexClasses: PermissionGrant[];
  visualforcePages: PermissionGrant[];
  tabs: PermissionGrant[];
  unavailable: string[];
}

export interface PermissionComparisonEntry {
  category: PermissionCategory;
  key: string;
  label: string;
  left: string;
  right: string;
  differs: boolean;
}

export type PermissionCategory =
  | 'System permissions'
  | 'Object permissions'
  | 'Field permissions'
  | 'Apex class access'
  | 'Visualforce page access'
  | 'Tab visibility';

export interface PermissionQueryResults {
  system?: QueryRecord[];
  objects?: QueryRecord[];
  fields?: QueryRecord[];
  apexClasses?: QueryRecord[];
  visualforcePages?: QueryRecord[];
  tabs?: QueryRecord[];
}

export function permissionSourcesFromRecords(records: QueryRecord[]): PermissionSource[] {
  return records
    .flatMap((record) => {
      const id = text(record.Id);
      const isProfile = record.IsOwnedByProfile === true;
      const profileName = text(path(record, 'Profile.Name'));
      const label = (isProfile ? profileName : text(record.Label)) || text(record.Name);
      const apiName = text(record.Name) || label;
      if (!validSalesforceId(id) || !label) return [];
      return [
        {
          id,
          kind: isProfile ? ('profile' as const) : ('permission-set' as const),
          label,
          apiName,
        },
      ];
    })
    .sort(
      (left, right) =>
        kindOrder(left.kind) - kindOrder(right.kind) ||
        left.label.localeCompare(right.label, undefined, { sensitivity: 'base', numeric: true }),
    );
}

export function matchingPermissionSources(
  sources: PermissionSource[],
  query: string,
  kind: PermissionSourceKind,
  limit = 12,
): PermissionSource[] {
  const needle = query.trim().toLocaleLowerCase();
  if (needle.length < 2) return [];
  return sources
    .filter(
      (source) =>
        source.kind === kind &&
        `${source.label} ${source.apiName}`.toLocaleLowerCase().includes(needle),
    )
    .slice(0, limit);
}

export function systemPermissionFieldNames(
  describe: Pick<SalesforceObjectDescribe, 'fields'>,
): string[] {
  return describe.fields
    .filter(isSystemPermissionField)
    .map((field) => field.name)
    .sort((left, right) => left.localeCompare(right));
}

export function buildPermissionSnapshot(
  source: PermissionSource,
  systemFieldNames: string[],
  results: PermissionQueryResults,
  unavailable: string[] = [],
): PermissionSnapshot {
  const systemRecord = results.system?.[0];
  return {
    source,
    system: systemFieldNames.map((name) => ({
      key: name,
      label: permissionLabel(name),
      value: systemRecord?.[name] === true ? 'Granted' : 'Not granted',
    })),
    objects: (results.objects ?? []).map((record) => {
      const objectName = text(record.SObjectType) || 'Unknown object';
      return {
        key: objectName,
        label: objectName,
        value: grantList(record, [
          ['PermissionsRead', 'Read'],
          ['PermissionsCreate', 'Create'],
          ['PermissionsEdit', 'Edit'],
          ['PermissionsDelete', 'Delete'],
          ['PermissionsViewAllRecords', 'View All'],
          ['PermissionsModifyAllRecords', 'Modify All'],
        ]),
      };
    }),
    fields: (results.fields ?? []).map((record) => {
      const field = text(record.Field) || 'Unknown field';
      return {
        key: field,
        label: field,
        value: grantList(record, [
          ['PermissionsRead', 'Read'],
          ['PermissionsEdit', 'Edit'],
        ]),
      };
    }),
    apexClasses: namedAccess(results.apexClasses ?? [], 'ApexClass.Name'),
    visualforcePages: namedAccess(results.visualforcePages ?? [], 'ApexPage.Name'),
    tabs: (results.tabs ?? []).flatMap((record) => {
      const name = text(record.Name);
      if (!name) return [];
      return [{ key: name, label: name, value: text(record.Visibility) || 'Configured' }];
    }),
    unavailable: [...new Set(unavailable)].sort(),
  };
}

export function comparePermissionSnapshots(
  left: PermissionSnapshot,
  right: PermissionSnapshot,
): PermissionComparisonEntry[] {
  const groups: Array<
    [
      PermissionCategory,
      keyof Pick<
        PermissionSnapshot,
        'system' | 'objects' | 'fields' | 'apexClasses' | 'visualforcePages' | 'tabs'
      >,
    ]
  > = [
    ['System permissions', 'system'],
    ['Object permissions', 'objects'],
    ['Field permissions', 'fields'],
    ['Apex class access', 'apexClasses'],
    ['Visualforce page access', 'visualforcePages'],
    ['Tab visibility', 'tabs'],
  ];

  return groups.flatMap(([category, property]) => {
    const leftMap = new Map(left[property].map((grant) => [grant.key, grant]));
    const rightMap = new Map(right[property].map((grant) => [grant.key, grant]));
    const keys = [...new Set([...leftMap.keys(), ...rightMap.keys()])].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }),
    );
    return keys.map((key) => {
      const leftGrant = leftMap.get(key);
      const rightGrant = rightMap.get(key);
      const leftValue = leftGrant?.value ?? 'Not granted';
      const rightValue = rightGrant?.value ?? 'Not granted';
      return {
        category,
        key,
        label: leftGrant?.label ?? rightGrant?.label ?? key,
        left: leftValue,
        right: rightValue,
        differs: leftValue !== rightValue,
      };
    });
  });
}

function isSystemPermissionField(field: SalesforceFieldSummary): boolean {
  return field.type === 'boolean' && /^Permissions[A-Z]/.test(field.name);
}

function namedAccess(records: QueryRecord[], namePath: string): PermissionGrant[] {
  return records.flatMap((record) => {
    const name = text(path(record, namePath));
    return name ? [{ key: name, label: name, value: 'Granted' }] : [];
  });
}

function grantList(record: QueryRecord, fields: Array<[string, string]>): string {
  const granted = fields.filter(([field]) => record[field] === true).map(([, label]) => label);
  return granted.length ? granted.join(', ') : 'Not granted';
}

function permissionLabel(name: string): string {
  return name
    .replace(/^Permissions/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/\bApi\b/g, 'API')
    .replace(/\bUi\b/g, 'UI');
}

function path(record: QueryRecord, propertyPath: string): unknown {
  return propertyPath.split('.').reduce<unknown>((current, property) => {
    if (!current || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[property];
  }, record);
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function validSalesforceId(value: string): boolean {
  return /^[A-Za-z0-9]{15}(?:[A-Za-z0-9]{3})?$/.test(value);
}

function kindOrder(kind: PermissionSourceKind): number {
  return kind === 'profile' ? 0 : 1;
}
