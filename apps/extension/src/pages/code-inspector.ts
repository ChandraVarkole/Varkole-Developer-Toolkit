import type {
  CustomTabMetadata,
  QueryRecord,
  SalesforceActionOverride,
  SalesforceObjectDescribe,
} from '@varkole/shared';
import type { PickedComponentContext } from '../component-picker';

export type CodeResourceKind =
  | 'Lightning page'
  | 'Apex class'
  | 'Apex trigger'
  | 'LWC'
  | 'Aura'
  | 'Visualforce page'
  | 'Visualforce component';

export type CodeRelationship =
  | 'Selected component'
  | 'Current page'
  | 'Object automation'
  | 'Related component';

export interface CodeResource {
  id: string;
  name: string;
  kind: CodeResourceKind;
  relationship: CodeRelationship;
  apiVersion?: string;
  status?: string;
  objectApiName?: string;
  parentId?: string;
}

export interface CodeFile {
  name: string;
  source: string;
  format?: string;
}

export interface SalesforcePageContext {
  experience: 'Lightning' | 'Classic';
  pathname: string;
  visualforceName?: string;
  componentName?: string;
  sourceId?: string;
  navigationTabName?: string;
}

const SOURCE_ID_KINDS: Record<string, CodeResourceKind> = {
  '01p': 'Apex class',
  '01q': 'Apex trigger',
  '066': 'Visualforce page',
  '099': 'Visualforce component',
  '0Ab': 'Aura',
  '0Rb': 'LWC',
  '0M0': 'Lightning page',
};

const METADATA_TYPE_KINDS: Record<string, CodeResourceKind> = {
  ApexClass: 'Apex class',
  ApexTrigger: 'Apex trigger',
  ApexPage: 'Visualforce page',
  ApexComponent: 'Visualforce component',
  LightningComponentBundle: 'LWC',
  AuraDefinitionBundle: 'Aura',
  FlexiPage: 'Lightning page',
};

export function pageContextFromSalesforceUrl(value?: string): SalesforcePageContext | undefined {
  if (!value) return undefined;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return undefined;
  }

  const route = decodedRouteVariants(`${url.pathname}${url.search}${url.hash}`).at(-1)!;
  const visualforceName = route.match(/\/apex\/([A-Za-z][A-Za-z0-9_]*)/i)?.[1];
  const componentRoute = route.match(
    /\/lightning\/cmp\/(?:[A-Za-z][A-Za-z0-9]*__)?([A-Za-z][A-Za-z0-9_]*)/i,
  )?.[1];
  const navigationTabName = route.match(/\/lightning\/n\/([A-Za-z][A-Za-z0-9_]*)/i)?.[1];
  const sourceId = route
    .split(/[^A-Za-z0-9]+/)
    .find(
      (candidate) =>
        /^[A-Za-z0-9]{15}(?:[A-Za-z0-9]{3})?$/.test(candidate) &&
        Boolean(SOURCE_ID_KINDS[candidate.slice(0, 3)]),
    );

  return {
    experience: /\/lightning\//i.test(route) ? 'Lightning' : 'Classic',
    pathname: url.pathname,
    ...(visualforceName ? { visualforceName } : {}),
    ...(componentRoute ? { componentName: componentRoute } : {}),
    ...(sourceId ? { sourceId } : {}),
    ...(navigationTabName ? { navigationTabName } : {}),
  };
}

export function customTabTargetQueries(tab: CustomTabMetadata): Array<{
  kind: CodeResourceKind;
  query: string;
}> {
  if (tab.lwcComponent) {
    const name = componentDeveloperName(tab.lwcComponent);
    return [
      {
        kind: 'LWC',
        query: `SELECT Id, DeveloperName, NamespacePrefix, ApiVersion FROM LightningComponentBundle WHERE DeveloperName = '${safeName(name)}' LIMIT 25`,
      },
    ];
  }
  if (tab.auraComponent) {
    const name = componentDeveloperName(tab.auraComponent);
    return [
      {
        kind: 'Aura',
        query: `SELECT Id, DeveloperName, NamespacePrefix, ApiVersion FROM AuraDefinitionBundle WHERE DeveloperName = '${safeName(name)}' LIMIT 25`,
      },
    ];
  }
  if (tab.flexiPage) {
    return [
      {
        kind: 'Lightning page',
        query: `SELECT Id, DeveloperName, MasterLabel, NamespacePrefix, Type, SobjectType FROM FlexiPage WHERE DeveloperName = '${safeName(componentDeveloperName(tab.flexiPage))}' LIMIT 1`,
      },
    ];
  }
  if (tab.page) {
    return [
      {
        kind: 'Visualforce page',
        query: `SELECT Id, Name, NamespacePrefix, ApiVersion FROM ApexPage WHERE Name = '${safeName(componentDeveloperName(tab.page))}' LIMIT 25`,
      },
    ];
  }
  return [];
}

export function activeRecordPageOverride(
  describe: SalesforceObjectDescribe,
  experience: SalesforcePageContext['experience'],
): SalesforceActionOverride | undefined {
  const candidates = (describe.actionOverrides ?? []).filter(
    (override) => override.name.toLowerCase() === 'view',
  );
  if (experience === 'Lightning') {
    return (
      candidates.find(
        (override) => override.formFactor?.toLowerCase() === 'large' && override.pageId,
      ) ?? candidates.find((override) => Boolean(override.pageId))
    );
  }
  return candidates.find((override) => Boolean(override.url) || Boolean(override.pageId));
}

export function directContextQueries(context?: SalesforcePageContext): Array<{
  kind: CodeResourceKind;
  query: string;
}> {
  if (!context) return [];
  if (context.visualforceName) {
    return [
      {
        kind: 'Visualforce page',
        query: `SELECT Id, Name, NamespacePrefix, ApiVersion FROM ApexPage WHERE Name = '${safeName(context.visualforceName)}' LIMIT 25`,
      },
    ];
  }
  if (context.sourceId) {
    const kind = SOURCE_ID_KINDS[context.sourceId.slice(0, 3)];
    return kind ? [{ kind, query: resourceLookupQuery(kind, context.sourceId) }] : [];
  }
  if (context.componentName) {
    const name = safeName(componentDeveloperName(context.componentName));
    return [
      {
        kind: 'LWC',
        query: `SELECT Id, DeveloperName, NamespacePrefix, ApiVersion FROM LightningComponentBundle WHERE DeveloperName = '${name}' LIMIT 25`,
      },
      {
        kind: 'Aura',
        query: `SELECT Id, DeveloperName, NamespacePrefix, ApiVersion FROM AuraDefinitionBundle WHERE DeveloperName = '${name}' LIMIT 25`,
      },
    ];
  }
  return [];
}

export function pickedComponentQueries(component: PickedComponentContext): Array<{
  kind: CodeResourceKind;
  query: string;
  relationship: CodeRelationship;
}> {
  const name = safeName(component.componentName);
  const namespace = namespacePredicate(component.namespace);
  const queries = [];
  if (component.kindHint !== 'aura') {
    queries.push({
      kind: 'LWC' as const,
      query: `SELECT Id, DeveloperName, NamespacePrefix, ApiVersion FROM LightningComponentBundle WHERE DeveloperName = '${name}'${namespace} LIMIT 25`,
      relationship: 'Selected component' as const,
    });
  }
  if (component.kindHint !== 'lwc') {
    queries.push({
      kind: 'Aura' as const,
      query: `SELECT Id, DeveloperName, NamespacePrefix, ApiVersion FROM AuraDefinitionBundle WHERE DeveloperName = '${name}'${namespace} LIMIT 25`,
      relationship: 'Selected component' as const,
    });
  }
  return queries;
}

export function recordTriggerQuery(objectApiName: string): string {
  return `SELECT Id, Name, NamespacePrefix, ApiVersion, Status, TableEnumOrId FROM ApexTrigger WHERE TableEnumOrId = '${safeName(objectApiName)}' ORDER BY Name LIMIT 100`;
}

export function customTabDependencyQuery(tabName: string): string {
  return `SELECT MetadataComponentId, MetadataComponentName, MetadataComponentType, RefMetadataComponentId, RefMetadataComponentName, RefMetadataComponentType FROM MetadataComponentDependency WHERE MetadataComponentType = 'CustomTab' AND MetadataComponentName = '${safeName(tabName)}' LIMIT 100`;
}

export function overrideResourceQuery(pageId: string): Array<{
  kind: CodeResourceKind;
  query: string;
}> {
  const safe = safeId(pageId);
  const known = SOURCE_ID_KINDS[safe.slice(0, 3)];
  if (known) return [{ kind: known, query: resourceLookupQuery(known, safe) }];
  return [
    {
      kind: 'Lightning page',
      query: `SELECT Id, DeveloperName, MasterLabel, NamespacePrefix, Type, SobjectType FROM FlexiPage WHERE Id = '${safe}' LIMIT 1`,
    },
    {
      kind: 'Visualforce page',
      query: `SELECT Id, Name, NamespacePrefix, ApiVersion FROM ApexPage WHERE Id = '${safe}' LIMIT 1`,
    },
  ];
}

export function codeResourceFromRecord(
  kind: CodeResourceKind,
  record: QueryRecord,
  relationship: CodeRelationship = 'Current page',
): CodeResource | undefined {
  const id = text(record.Id);
  const name = text(record.Name) || text(record.DeveloperName) || text(record.MasterLabel);
  const apiVersion = scalar(record.ApiVersion);
  if (!id || !name) return undefined;
  return {
    id,
    name,
    kind,
    relationship,
    ...(apiVersion ? { apiVersion } : {}),
    ...(text(record.Status) ? { status: text(record.Status) } : {}),
    ...(text(record.TableEnumOrId) ? { objectApiName: text(record.TableEnumOrId) } : {}),
  };
}

export function dependencyQuery(resourceIds: string[]): string | undefined {
  const ids = [...new Set(resourceIds)].slice(0, 100).map(safeId);
  if (!ids.length) return undefined;
  return `SELECT MetadataComponentId, MetadataComponentName, MetadataComponentType, RefMetadataComponentId, RefMetadataComponentName, RefMetadataComponentType FROM MetadataComponentDependency WHERE MetadataComponentId IN (${ids.map((id) => `'${id}'`).join(', ')}) LIMIT 500`;
}

export function codeResourcesFromDependencies(
  records: QueryRecord[],
  relationship: CodeRelationship = 'Related component',
): CodeResource[] {
  const resources = records
    .map((record): CodeResource | undefined => {
      const id = text(record.RefMetadataComponentId);
      const name = text(record.RefMetadataComponentName);
      const kind = METADATA_TYPE_KINDS[text(record.RefMetadataComponentType)];
      if (!id || !name || !kind) return undefined;
      return {
        id,
        name,
        kind,
        relationship,
        ...(text(record.MetadataComponentId) ? { parentId: text(record.MetadataComponentId) } : {}),
      };
    })
    .filter((resource): resource is CodeResource => Boolean(resource));
  return uniqueCodeResources(resources);
}

export function sourceQuery(resource: CodeResource): string {
  const id = safeId(resource.id);
  switch (resource.kind) {
    case 'Lightning page':
      return `SELECT Id, DeveloperName, MasterLabel, Metadata FROM FlexiPage WHERE Id = '${id}' LIMIT 1`;
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
      const metadata = record.Metadata;
      const source =
        text(record.Source) ||
        text(record.Body) ||
        text(record.Markup) ||
        (metadata && typeof metadata === 'object' ? JSON.stringify(metadata, null, 2) : '');
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

export function sortContextResources(resources: CodeResource[]): CodeResource[] {
  const priority: Record<CodeRelationship, number> = {
    'Selected component': 0,
    'Current page': 1,
    'Object automation': 2,
    'Related component': 3,
  };
  return uniqueCodeResources(resources).sort(
    (left, right) =>
      priority[left.relationship] - priority[right.relationship] ||
      left.name.localeCompare(right.name, undefined, { sensitivity: 'base', numeric: true }),
  );
}

function resourceLookupQuery(kind: CodeResourceKind, id: string): string {
  const safe = safeId(id);
  switch (kind) {
    case 'Lightning page':
      return `SELECT Id, DeveloperName, MasterLabel, NamespacePrefix, Type, SobjectType FROM FlexiPage WHERE Id = '${safe}' LIMIT 1`;
    case 'Apex class':
      return `SELECT Id, Name, NamespacePrefix, ApiVersion, Status FROM ApexClass WHERE Id = '${safe}' LIMIT 1`;
    case 'Apex trigger':
      return `SELECT Id, Name, NamespacePrefix, ApiVersion, Status, TableEnumOrId FROM ApexTrigger WHERE Id = '${safe}' LIMIT 1`;
    case 'LWC':
      return `SELECT Id, DeveloperName, NamespacePrefix, ApiVersion FROM LightningComponentBundle WHERE Id = '${safe}' LIMIT 1`;
    case 'Aura':
      return `SELECT Id, DeveloperName, NamespacePrefix, ApiVersion FROM AuraDefinitionBundle WHERE Id = '${safe}' LIMIT 1`;
    case 'Visualforce page':
      return `SELECT Id, Name, NamespacePrefix, ApiVersion FROM ApexPage WHERE Id = '${safe}' LIMIT 1`;
    case 'Visualforce component':
      return `SELECT Id, Name, NamespacePrefix, ApiVersion FROM ApexComponent WHERE Id = '${safe}' LIMIT 1`;
  }
}

function uniqueCodeResources(resources: CodeResource[]): CodeResource[] {
  const byId = new Map<string, CodeResource>();
  for (const resource of resources) {
    const previous = byId.get(resource.id);
    if (!previous || previous.relationship === 'Related component') byId.set(resource.id, resource);
  }
  return [...byId.values()];
}

function decodedRouteVariants(value: string): string[] {
  const variants = [value];
  let current = value;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const decoded = decodeURIComponent(current);
      if (decoded === current) break;
      variants.push(decoded);
      current = decoded;
    } catch {
      break;
    }
  }
  return variants;
}

function safeId(value: string): string {
  if (!/^[A-Za-z0-9]{15}(?:[A-Za-z0-9]{3})?$/.test(value)) {
    throw new Error('Salesforce returned an invalid code resource ID.');
  }
  return value;
}

function safeName(value: string): string {
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(value)) {
    throw new Error('Salesforce returned an invalid metadata name.');
  }
  return value;
}

function namespacePredicate(value?: string): string {
  if (!value || value.toLowerCase() === 'c') return ' AND NamespacePrefix = null';
  return ` AND NamespacePrefix = '${safeName(value)}'`;
}

function componentDeveloperName(value: string): string {
  const normalized = value.trim().split(':').at(-1)?.split('__').at(-1) ?? '';
  return normalized;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function scalar(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}
