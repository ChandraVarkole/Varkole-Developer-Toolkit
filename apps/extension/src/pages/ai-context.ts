import type {
  OrgIdentity,
  OrgInfo,
  QueryPage,
  SalesforceObjectDescribe,
  SalesforceObjectSummary,
} from '@varkole/shared';

export interface AiReadPlan {
  objects: string[];
  queries: string[];
}

export interface AiQueryObservation {
  query: string;
  result?: QueryPage | undefined;
  error?: string | undefined;
}

const DEFAULT_AI_RECORD_LIMIT = 20;
const MAX_AI_RECORD_LIMIT = 200;

export function normalizeAiContextQuery(value: string): string {
  const query = value.trim();
  if (query.length > 5_000) throw new Error('AI context queries must be under 5,000 characters.');
  if (!/^select\s/i.test(query)) {
    throw new Error('AI record context must be a read-only SELECT query.');
  }
  if (query.includes(';') || /\/\*|\*\/|--/.test(query)) {
    throw new Error('Comments and multiple SOQL statements are not allowed in AI context.');
  }
  if (/\b(for\s+update|update|delete|insert|upsert|merge|undelete|execute)\b/i.test(query)) {
    throw new Error('Only a read-only SELECT query can be shared with the AI provider.');
  }
  const limit = query.match(/\blimit\s+(\d+)\b/i);
  if (limit) {
    const count = Number(limit[1]);
    if (!Number.isInteger(count) || count < 1 || count > MAX_AI_RECORD_LIMIT) {
      throw new Error(`AI context queries must use LIMIT 1 through ${MAX_AI_RECORD_LIMIT}.`);
    }
    return query;
  }
  if (/\boffset\b/i.test(query)) {
    throw new Error(`Add LIMIT ${MAX_AI_RECORD_LIMIT} or less before using OFFSET.`);
  }
  return `${query} LIMIT ${DEFAULT_AI_RECORD_LIMIT}`;
}

export function buildAiPlanningContext(
  org: OrgIdentity,
  objects: SalesforceObjectSummary[],
  question = '',
): string {
  const terms = question
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter((term) => term.length >= 3);
  const accessibleObjects = objects
    .filter((object) => object.queryable)
    .sort((left, right) => relevance(right, terms) - relevance(left, terms))
    .slice(0, 400);
  return JSON.stringify({
    task: [
      'Return JSON only with this shape: {"objects": ["ObjectApiName"], "queries": ["SELECT ... LIMIT n"]}.',
      'Choose at most 5 objects to describe and at most 6 SOQL SELECT queries needed to answer the user completely.',
      'Use only object API names from accessibleObjects. Never request writes or Apex.',
      'Select only fields needed for the answer. Use LIMIT 200 when the user explicitly asks for all, a complete list, or a roster; otherwise use LIMIT 20 or less.',
      'When record fields are unknown, use SELECT FIELDS(STANDARD) rather than inventing field names.',
      'Use the conversation to preserve earlier object names, filters, dates, and follow-up intent.',
      'For recommendations or decisions, retrieve the records, metadata, access, or limits needed to support the conclusion rather than returning generic advice.',
      'Use empty arrays when the question can be answered from organization metadata alone.',
    ],
    organization: {
      name: org.organizationName,
      environment: org.environment,
      user: org.displayName,
    },
    accessibleObjects: accessibleObjects.map((object) => ({
      name: object.name,
      label: object.label,
      custom: object.custom,
    })),
  });
}

function relevance(object: SalesforceObjectSummary, terms: string[]): number {
  const text = `${object.label} ${object.name}`.toLowerCase();
  return terms.reduce((score, term) => score + (text.includes(term) ? 1 : 0), 0);
}

export function parseAiReadPlan(response: string, objects: SalesforceObjectSummary[]): AiReadPlan {
  const start = response.indexOf('{');
  const end = response.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('AI Agent could not create a safe read plan.');

  let value: unknown;
  try {
    value = JSON.parse(response.slice(start, end + 1));
  } catch {
    throw new Error('AI Agent returned an unreadable read plan. Please rephrase the question.');
  }
  if (!value || typeof value !== 'object') {
    throw new Error('AI Agent returned an invalid read plan.');
  }

  const candidate = value as { objects?: unknown; queries?: unknown };
  const plannedObjects = Array.isArray(candidate.objects)
    ? candidate.objects
        .filter((item): item is string => typeof item === 'string')
        .map((item) => resolveAiObjectName(item, objects))
        .filter((item): item is string => Boolean(item))
    : [];
  const plannedQueries = Array.isArray(candidate.queries)
    ? candidate.queries
        .filter((item): item is string => typeof item === 'string')
        .map((item) => {
          try {
            return canonicalizeAiReadQuery(item, objects);
          } catch {
            return undefined;
          }
        })
        .filter((item): item is string => Boolean(item))
    : [];
  const queriedObjects = plannedQueries
    .map((query) => extractAiQueryObjectName(query, objects))
    .filter((item): item is string => Boolean(item));

  return {
    objects: [...new Set([...plannedObjects, ...queriedObjects])].slice(0, 5),
    queries: [...new Set(plannedQueries)].slice(0, 6),
  };
}

export function resolveAiObjectName(
  requested: string,
  objects: SalesforceObjectSummary[],
): string | undefined {
  const needle = normalizeObjectName(requested);
  if (!needle) return undefined;
  const exact = objects.find(
    (object) =>
      normalizeObjectName(object.name) === needle || normalizeObjectName(object.label) === needle,
  );
  if (exact) return exact.name;
  if (needle.length < 5) return undefined;
  return objects
    .filter((object) => {
      const name = normalizeObjectName(object.name);
      const label = normalizeObjectName(object.label);
      return name.includes(needle) || label.includes(needle) || needle.includes(name);
    })
    .sort(
      (left, right) =>
        Math.abs(normalizeObjectName(left.name).length - needle.length) -
        Math.abs(normalizeObjectName(right.name).length - needle.length),
    )[0]?.name;
}

export function canonicalizeAiReadQuery(
  value: string,
  objects: SalesforceObjectSummary[],
): string | undefined {
  const query = normalizeAiContextQuery(value);
  const matches = [...query.matchAll(/\bFROM\s+([a-z][a-z0-9_]*)/gi)];
  const mainFrom = matches.at(-1);
  const requested = mainFrom?.[1];
  if (!mainFrom || !requested || mainFrom.index === undefined) return undefined;
  const resolved = resolveAiObjectName(requested, objects);
  if (!resolved) return undefined;
  const objectStart = mainFrom.index + mainFrom[0].lastIndexOf(requested);
  return `${query.slice(0, objectStart)}${resolved}${query.slice(objectStart + requested.length)}`;
}

function extractAiQueryObjectName(
  query: string,
  objects: SalesforceObjectSummary[],
): string | undefined {
  const matches = [...query.matchAll(/\bFROM\s+([a-z][a-z0-9_]*)/gi)];
  const requested = matches.at(-1)?.[1];
  return requested ? resolveAiObjectName(requested, objects) : undefined;
}

function normalizeObjectName(value: string): string {
  return value
    .toLowerCase()
    .replace(/__(?:c|mdt|e|b|x)$/i, '')
    .replace(/[^a-z0-9]/g, '')
    .replace(/s$/, '');
}

export function buildAutomaticAiContext(input: {
  org: OrgIdentity;
  orgInfo?: OrgInfo | undefined;
  objects: SalesforceObjectSummary[];
  describes: SalesforceObjectDescribe[];
  observations: AiQueryObservation[];
  focus?: string | undefined;
}): string {
  for (const [fieldLimit, recordLimit, objectLimit] of [
    [60, 200, 60],
    [30, 200, 30],
    [15, 200, 15],
    [8, 200, 8],
    [8, 100, 8],
    [5, 50, 5],
    [3, 20, 3],
  ] as const) {
    const serialized = JSON.stringify(
      automaticContextValue(input, fieldLimit, recordLimit, objectLimit),
      null,
      2,
    );
    if (serialized.length <= 49_000) return serialized;
  }
  throw new Error('The automatic Salesforce context is too large. Ask a narrower question.');
}

function automaticContextValue(
  input: Parameters<typeof buildAutomaticAiContext>[0],
  fieldLimit: number,
  recordLimit: number,
  objectLimit: number,
) {
  const focusTerms = (input.focus ?? '')
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter((term) => term.length >= 3);
  return {
    instructions:
      'Answer as a senior Salesforce architect and developer using only these current read-only observations plus the conversation. They override unsupported claims in earlier messages. The lookups ran with the current user session, so missing or denied data must not be assumed. Give detailed evidence, impact, a recommended decision, exact Salesforce implementation and validation steps, and safe SOQL examples when useful. Never ask the user to manually provide schema or query results; explain any lookup error instead.',
    organization: {
      name: input.org.organizationName,
      environment: input.org.environment,
      signedInUser: input.org.displayName,
      username: input.org.username,
      type: input.orgInfo?.organizationType,
      instance: input.orgInfo?.instanceName,
      apiVersion: input.org.apiVersion,
      limits: input.orgInfo?.limits,
    },
    accessibleObjects: [...input.objects]
      .filter((object) => object.queryable)
      .sort((left, right) => relevance(right, focusTerms) - relevance(left, focusTerms))
      .slice(0, objectLimit)
      .map((object) => ({ label: object.label, name: object.name, custom: object.custom })),
    relevantSchemas: input.describes.map((describe) => ({
      object: describe.label,
      name: describe.name,
      fieldCount: describe.fields.length,
      fields: describe.fields.slice(0, fieldLimit).map((field) => ({
        label: field.label,
        name: field.name,
        type: field.type,
        filterable: field.filterable,
        createable: field.createable,
        updateable: field.updateable,
        ...(field.referenceTo?.length ? { referenceTo: field.referenceTo } : {}),
      })),
    })),
    readOnlyLookups: input.observations.map((observation) => ({
      query: observation.query,
      ...(observation.error
        ? { error: observation.error }
        : {
            totalSize: observation.result?.totalSize ?? 0,
            returnedRecords: observation.result?.records.length ?? 0,
            includedRecords: Math.min(observation.result?.records.length ?? 0, recordLimit),
            truncated: (observation.result?.records.length ?? 0) > recordLimit,
            records: (observation.result?.records ?? [])
              .slice(0, recordLimit)
              .map((record) =>
                sanitizeValue(
                  Object.fromEntries(
                    Object.entries(record).filter(([fieldName]) => fieldName !== 'attributes'),
                  ),
                ),
              ),
          }),
    })),
  };
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return value.slice(0, 2_000);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (depth >= 4) return '[nested value omitted]';
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeValue(item, depth + 1));
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 50)
        .map(([key, item]) => [key, sanitizeValue(item, depth + 1)]),
    );
  }
  return '[unsupported value]';
}
