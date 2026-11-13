import type { QueryRecord } from '@varkole/shared';

export type CodeResourceKind =
  | 'Apex class'
  | 'Apex trigger'
  | 'LWC'
  | 'Aura'
  | 'Visualforce page'
  | 'Visualforce component';

export interface CodeResource {
  id: string;
  name: string;
  kind: CodeResourceKind;
  apiVersion?: string;
  status?: string;
  objectApiName?: string;
}

export interface CodeFile {
  name: string;
  source: string;
  format?: string;
}

export interface CodeInventoryDefinition {
  kind: CodeResourceKind;
  query: string;
}

export const CODE_INVENTORY: CodeInventoryDefinition[] = [
  {
    kind: 'Apex class',
    query:
      "SELECT Id, Name, NamespacePrefix, ApiVersion, Status FROM ApexClass WHERE ManageableState = 'unmanaged' ORDER BY Name LIMIT 500",
  },
  {
    kind: 'Apex trigger',
    query:
      "SELECT Id, Name, NamespacePrefix, ApiVersion, Status, TableEnumOrId FROM ApexTrigger WHERE ManageableState = 'unmanaged' ORDER BY Name LIMIT 500",
  },
  {
    kind: 'LWC',
    query:
      "SELECT Id, DeveloperName, NamespacePrefix, ApiVersion FROM LightningComponentBundle WHERE ManageableState = 'unmanaged' ORDER BY DeveloperName LIMIT 500",
  },
  {
    kind: 'Aura',
    query:
      "SELECT Id, DeveloperName, NamespacePrefix, ApiVersion FROM AuraDefinitionBundle WHERE ManageableState = 'unmanaged' ORDER BY DeveloperName LIMIT 500",
  },
  {
    kind: 'Visualforce page',
    query:
      "SELECT Id, Name, NamespacePrefix, ApiVersion FROM ApexPage WHERE ManageableState = 'unmanaged' ORDER BY Name LIMIT 500",
  },
  {
    kind: 'Visualforce component',
    query:
      "SELECT Id, Name, NamespacePrefix, ApiVersion FROM ApexComponent WHERE ManageableState = 'unmanaged' ORDER BY Name LIMIT 500",
  },
];

export function codeResourceFromRecord(
  kind: CodeResourceKind,
  record: QueryRecord,
): CodeResource | undefined {
  const id = text(record.Id);
  const name = text(record.Name) || text(record.DeveloperName);
  const apiVersion = scalar(record.ApiVersion);
  if (!id || !name) return undefined;
  return {
    id,
    name,
    kind,
    ...(apiVersion ? { apiVersion } : {}),
    ...(text(record.Status) ? { status: text(record.Status) } : {}),
    ...(text(record.TableEnumOrId) ? { objectApiName: text(record.TableEnumOrId) } : {}),
  };
}

export function sourceQuery(resource: CodeResource): string {
  const id = safeId(resource.id);
  switch (resource.kind) {
    case 'Apex class':
      return `SELECT Id, Name, Body FROM ApexClass WHERE Id = '${id}' LIMIT 1`;
    case 'Apex trigger':
      return `SELECT Id, Name, Body FROM ApexTrigger WHERE Id = '${id}' LIMIT 1`;
    case 'LWC':
      return `SELECT Id, FilePath, Format, Source FROM LightningComponentResource WHERE LightningComponentBundleId = '${id}' ORDER BY FilePath`;
    case 'Aura':
      return `SELECT Id, DefType, Format, Source FROM AuraDefinition WHERE AuraDefinitionBundleId = '${id}' ORDER BY DefType`;
    case 'Visualforce page':
      return `SELECT Id, Name, Markup FROM ApexPage WHERE Id = '${id}' LIMIT 1`;
    case 'Visualforce component':
      return `SELECT Id, Name, Markup FROM ApexComponent WHERE Id = '${id}' LIMIT 1`;
  }
}

export function codeFilesFromRecords(resource: CodeResource, records: QueryRecord[]): CodeFile[] {
  return records
    .map((record, index) => {
      const source = text(record.Source) || text(record.Body) || text(record.Markup);
      if (!source) return undefined;
      const suffix = text(record.FilePath) || text(record.DefType) || resource.name;
      return {
        name: suffix || `${resource.name}-${index + 1}`,
        source,
        ...(text(record.Format) ? { format: text(record.Format) } : {}),
      };
    })
    .filter((file): file is CodeFile => Boolean(file));
}

export function relatedCodeResources(
  selected: CodeResource,
  files: CodeFile[],
  inventory: CodeResource[],
  limit = 24,
): CodeResource[] {
  const source = files.map((file) => file.source).join('\n');
  if (!source) return [];
  return inventory
    .filter(
      (candidate) =>
        candidate.id !== selected.id &&
        candidate.name.length > 2 &&
        new RegExp(`\\b${escapeRegExp(candidate.name)}\\b`).test(source),
    )
    .slice(0, limit);
}

export function sortCodeResources(
  resources: CodeResource[],
  currentObjectApiName?: string,
): CodeResource[] {
  return [...resources].sort((left, right) => {
    const leftCurrent = left.objectApiName === currentObjectApiName ? 0 : 1;
    const rightCurrent = right.objectApiName === currentObjectApiName ? 0 : 1;
    return (
      leftCurrent - rightCurrent ||
      left.name.localeCompare(right.name, undefined, { sensitivity: 'base', numeric: true })
    );
  });
}

function safeId(value: string): string {
  if (!/^[A-Za-z0-9]{15}(?:[A-Za-z0-9]{3})?$/.test(value)) {
    throw new Error('Salesforce returned an invalid code resource ID.');
  }
  return value;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function scalar(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
