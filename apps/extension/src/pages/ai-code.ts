import type { AiQueryObservation } from './ai-context';

const CODE_INTENT =
  /\b(code|source|lwc|lightning web component|component|apex|class|trigger|aura|visualforce|implementation|handler|button|action|sync)\b/i;
const GENERIC_TERMS = new Set([
  'Agent',
  'Apex',
  'Aura',
  'Button',
  'Class',
  'Code',
  'Component',
  'Current',
  'Handler',
  'Implementation',
  'Lightning',
  'LWC',
  'Now',
  'Salesforce',
  'Source',
  'Trigger',
  'User',
  'Visualforce',
]);

export function buildCodeDiscoveryQueries(conversation: string): string[] {
  if (!CODE_INTENT.test(conversation)) return [];
  const terms = codeSearchTerms(conversation);
  const queries: string[] = [];
  const apexIntent = /\b(apex|class|trigger)\b/i.test(conversation);
  const lwcIntent = /\b(lwc|lightning web component)\b/i.test(conversation);
  const auraIntent = /\baura\b/i.test(conversation);
  const visualforceIntent = /\bvisualforce\b/i.test(conversation);
  const ambiguous = !apexIntent && !lwcIntent && !auraIntent && !visualforceIntent;

  if (apexIntent || ambiguous) {
    queries.push(
      toolingQuery(
        'ApexClass',
        terms,
        'Name',
        terms.length
          ? 'Id, Name, NamespacePrefix, Status, ApiVersion, Body'
          : 'Id, Name, NamespacePrefix, Status, ApiVersion',
      ),
      toolingQuery(
        'ApexTrigger',
        terms,
        'Name',
        terms.length
          ? 'Id, Name, NamespacePrefix, Status, ApiVersion, TableEnumOrId, Body'
          : 'Id, Name, NamespacePrefix, Status, ApiVersion, TableEnumOrId',
      ),
    );
  }
  if (lwcIntent || ambiguous) {
    queries.push(
      toolingQuery(
        'LightningComponentBundle',
        terms,
        'DeveloperName',
        'Id, DeveloperName, NamespacePrefix, MasterLabel, Description, ApiVersion',
      ),
    );
  }
  if (auraIntent || ambiguous) {
    queries.push(
      toolingQuery(
        'AuraDefinitionBundle',
        terms,
        'DeveloperName',
        'Id, DeveloperName, NamespacePrefix, MasterLabel, Description, ApiVersion',
      ),
    );
  }
  if (visualforceIntent || ambiguous) {
    queries.push(
      toolingQuery(
        'ApexPage',
        terms,
        'Name',
        terms.length
          ? 'Id, Name, NamespacePrefix, ApiVersion, Markup'
          : 'Id, Name, NamespacePrefix, ApiVersion',
      ),
      toolingQuery(
        'ApexComponent',
        terms,
        'Name',
        terms.length
          ? 'Id, Name, NamespacePrefix, ApiVersion, Markup'
          : 'Id, Name, NamespacePrefix, ApiVersion',
      ),
    );
  }
  return queries.slice(0, 6);
}

export function buildCodeResourceQueries(observations: AiQueryObservation[]): string[] {
  const lwcBundleIds = matchingIds(observations, 'LightningComponentBundle').slice(0, 5);
  const auraBundleIds = matchingIds(observations, 'AuraDefinitionBundle').slice(0, 5);
  const queries: string[] = [];
  if (lwcBundleIds.length) {
    queries.push(
      `SELECT Id, LightningComponentBundleId, FilePath, Format, Source FROM LightningComponentResource WHERE LightningComponentBundleId IN (${quotedIds(lwcBundleIds)}) ORDER BY FilePath LIMIT 100`,
    );
  }
  if (auraBundleIds.length) {
    queries.push(
      `SELECT Id, AuraDefinitionBundleId, DefType, Format, Source FROM AuraDefinition WHERE AuraDefinitionBundleId IN (${quotedIds(auraBundleIds)}) ORDER BY DefType LIMIT 100`,
    );
  }
  return queries;
}

export function cleanEvidenceCitations(answer: string): string {
  return answer
    .replace(/[ \t]*(?:\[E\d+])+[ \t]*/g, ' ')
    .replace(/[ \t]+([,.;:!?])/g, '$1')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

function toolingQuery(
  objectName: string,
  terms: string[],
  nameField: string,
  fields: string,
): string {
  const where = terms.length
    ? ` WHERE ${terms.map((term) => `${nameField} LIKE '%${term}%'`).join(' OR ')}`
    : '';
  return `SELECT ${fields} FROM ${objectName}${where} ORDER BY ${nameField} LIMIT ${terms.length ? 25 : 100}`;
}

function codeSearchTerms(conversation: string): string[] {
  const candidates = [
    ...(conversation.match(/`([A-Za-z][A-Za-z0-9_]*)`/g) ?? []).map((value) =>
      value.replaceAll('`', ''),
    ),
    ...(conversation.match(/\b[A-Z][A-Za-z0-9_]{2,}\b/g) ?? []),
  ];
  const expanded = candidates.flatMap((candidate) => [candidate, ...candidate.split('_')]);
  return [...new Set(expanded)]
    .filter((term) => term.length >= 3 && !GENERIC_TERMS.has(term))
    .sort((left, right) => right.length - left.length || left.localeCompare(right))
    .slice(0, 4);
}

function matchingIds(observations: AiQueryObservation[], type: string): string[] {
  return observations
    .filter((observation) => observation.apiMode === 'tooling')
    .flatMap((observation) => observation.result?.records ?? [])
    .filter((record) => record.attributes?.type === type && typeof record.Id === 'string')
    .map((record) => record.Id as string)
    .filter((id, index, ids) => ids.indexOf(id) === index);
}

function quotedIds(ids: string[]): string {
  return ids.map((id) => `'${id}'`).join(', ');
}
