import type { QueryPage, SalesforceObjectDescribe, SalesforceObjectSummary } from '@varkole/shared';
import type { AiQueryObservation } from './ai-context';

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

export function selectRelevantAiObjects(
  objects: SalesforceObjectSummary[],
  conversation: string,
  limit = 4,
): string[] {
  const terms = conversation
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter((term) => term.length >= 3);
  return objects
    .filter((object) => object.queryable)
    .map((object) => ({
      object,
      score: terms.reduce(
        (score, term) => {
          const name = `${object.label} ${object.name}`.toLowerCase();
          return score + (name.includes(term) ? 1 : 0);
        },
        intentObjectScore(object, conversation),
      ),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score || collator.compare(left.object.label, right.object.label),
    )
    .slice(0, limit)
    .map(({ object }) => object.name);
}

function intentObjectScore(object: SalesforceObjectSummary, conversation: string): number {
  const name = object.name.toLowerCase();
  let score = 0;
  if (/\b(reports?|reporting)\b/i.test(conversation) && name === 'report') score += 8;
  if (/\b(dashboards?|charts?|metrics?)\b/i.test(conversation) && name === 'dashboard') score += 8;
  if (
    /\b(flows?|automation|record-triggered|screen flow)\b/i.test(conversation) &&
    name.includes('flow')
  ) {
    score += 7;
  }
  if (/\b(permission|access|profile|privilege)\b/i.test(conversation)) {
    if (name === 'permissionsetassignment' || name === 'permissionset' || name === 'user')
      score += 6;
  }
  return score;
}

export function relatedDescribeNames(
  describes: SalesforceObjectDescribe[],
  objects: SalesforceObjectSummary[],
  existingNames: string[],
  limit = 6,
): string[] {
  const accessible = new Set(
    objects.filter((object) => object.queryable).map((object) => object.name),
  );
  const related = new Set<string>();
  for (const describe of describes) {
    for (const field of describe.fields) {
      for (const target of field.referenceTo ?? []) {
        if (accessible.has(target)) related.add(target);
      }
    }
    for (const relationship of describe.childRelationships) {
      if (accessible.has(relationship.childSObject)) related.add(relationship.childSObject);
    }
  }
  return [
    ...new Set([
      ...existingNames,
      ...[...related].sort((left, right) => collator.compare(left, right)),
    ]),
  ].slice(0, limit);
}

export function relationshipEvidenceForQuery(query: string): string[] {
  const object = mainQueryObject(query);
  if (!object) return [];
  const relationships = new Set<string>([object]);
  for (const match of query.matchAll(/\b([A-Za-z][A-Za-z0-9_]*Id)\b/g)) {
    relationships.add(`${object}.${match[1]}`);
  }
  for (const match of query.matchAll(/\b([A-Za-z][A-Za-z0-9_]*)\.[A-Za-z][A-Za-z0-9_]*\b/g)) {
    relationships.add(`${object}.${match[1]}`);
  }
  return [...relationships];
}

export function shouldRequestRelationshipGapPlan(
  conversation: string,
  observations: AiQueryObservation[],
): boolean {
  const relationshipIntent =
    /\b(related|relationship|associated|linked)\b/i.test(conversation) ||
    /\b(cases?|contacts?|opportunities|records?)\b[^.?!]{0,80}\b(for|of)\b/i.test(conversation);
  if (!relationshipIntent) return false;
  const queries = observations.map((observation) => observation.query).join('\n');
  if (/\bcases?\b/i.test(conversation)) {
    return !/\bFROM\s+Case\b/i.test(queries) || !/\b(?:ContactId|Contact\.)\b/i.test(queries);
  }
  return !observations.some(
    (observation) => relationshipEvidenceForQuery(observation.query).length > 1,
  );
}

export function shouldRequestDataGapPlan(
  conversation: string,
  observations: AiQueryObservation[],
): boolean {
  const queries = observations.map((observation) => observation.query).join('\n');
  const successful = observations.filter((observation) => observation.result && !observation.error);
  const dataIntent =
    /\b(show|list|find|get|retrieve|query|records?|rows?|who|which users?|how many|count|sum|average|avg|minimum|maximum|total)\b/i.test(
      conversation,
    ) ||
    /\b(reports?|dashboards?|permissions?|profiles?|access assignments?)\b/i.test(conversation);
  if (!dataIntent) return false;
  if (observations.length === 0 || successful.length === 0) return true;
  if (/\breports?\b/i.test(conversation) && !/\bFROM\s+Report\b/i.test(queries)) return true;
  if (/\bdashboards?\b/i.test(conversation) && !/\bFROM\s+Dashboard\b/i.test(queries)) return true;
  if (/\b(how many|count|sum|average|avg|minimum|maximum|total)\b/i.test(conversation)) {
    return !/\b(COUNT|SUM|AVG|MIN|MAX)\s*\(/i.test(queries);
  }
  return false;
}

export function mergeAiEvidence(
  retained: AiQueryObservation[],
  current: AiQueryObservation[],
  limit = 20,
): AiQueryObservation[] {
  const byQuery = new Map<string, AiQueryObservation>();
  for (const observation of [...retained, ...current]) {
    byQuery.set(
      `${observation.apiMode ?? 'rest'}:${observation.query.trim().toLowerCase()}`,
      observation,
    );
  }
  return [...byQuery.values()].slice(-limit);
}

export function mergeQueryPages(pages: QueryPage[], recordLimit: number): QueryPage {
  if (pages.length === 0) throw new Error('At least one Salesforce query page is required.');
  const last = pages.at(-1)!;
  const allRecords = pages.flatMap((page) => page.records);
  const records = allRecords.slice(0, recordLimit);
  const capped =
    allRecords.length > recordLimit ||
    Boolean(last.nextRecordsUrl && records.length >= recordLimit);
  return {
    totalSize: pages[0]!.totalSize,
    done: last.done && !capped,
    records,
    ...(last.nextRecordsUrl && !capped ? { nextRecordsUrl: last.nextRecordsUrl } : {}),
    ...(last.apiUsage ? { apiUsage: last.apiUsage } : {}),
    elapsedMs: pages.reduce((total, page) => total + page.elapsedMs, 0),
  };
}

export function evidenceAnswerIssue(
  answer: string,
  observations: AiQueryObservation[],
): string | undefined {
  const successful = observations.filter((observation) => observation.result && !observation.error);
  if (/\b(found|returned|retrieved)\b/i.test(answer) && successful.length === 0) {
    return 'The answer claimed retrieval without a successful Salesforce result.';
  }
  const zeroResults = successful.some((observation) => observation.result?.records.length === 0);
  if (/\b(?:no|zero)\s+(?:matching\s+)?records?\b/i.test(answer) && !zeroResults) {
    return 'The answer claimed zero records without a successful zero-row lookup.';
  }

  const evidenceIds = new Set(observations.map((_, index) => `E${index + 1}`));
  const citedIds = [...answer.matchAll(/\[(E\d+)]/g)].map((match) => match[1]!);
  const invalidCitation = citedIds.find((id) => !evidenceIds.has(id));
  if (invalidCitation) return `The answer cited unavailable evidence ${invalidCitation}.`;

  if (observations.length > 0 && citedIds.length === 0) {
    return 'Answers based on Salesforce lookups must cite a supplied evidence item.';
  }
  return undefined;
}

export function mainQueryObject(query: string): string | undefined {
  const matches = [...query.matchAll(/\bFROM\s+([A-Za-z][A-Za-z0-9_]*)/gi)];
  return matches.at(-1)?.[1];
}
