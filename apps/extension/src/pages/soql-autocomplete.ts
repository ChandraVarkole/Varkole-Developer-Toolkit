import type { SalesforceFieldSummary } from '@varkole/shared';

export interface SoqlSuggestion {
  value: string;
  label: string;
  detail: string;
  kind: 'field' | 'clause' | 'function';
}

const CLAUSES = [
  'SELECT',
  'FROM',
  'WHERE',
  'AND',
  'OR',
  'ORDER BY',
  'GROUP BY',
  'HAVING',
  'LIMIT',
  'OFFSET',
  'ASC',
  'DESC',
  'NULLS FIRST',
  'NULLS LAST',
  'LIKE',
  'IN',
  'NOT IN',
  'INCLUDES',
  'EXCLUDES',
  'TYPEOF',
  'WITH SECURITY_ENFORCED',
  'WITH USER_MODE',
  'FOR VIEW',
  'FOR REFERENCE',
  'FOR UPDATE',
  'ALL ROWS',
];

const FUNCTIONS = [
  'COUNT()',
  'COUNT_DISTINCT()',
  'SUM()',
  'AVG()',
  'MIN()',
  'MAX()',
  'CALENDAR_MONTH()',
  'CALENDAR_YEAR()',
  'DAY_IN_MONTH()',
  'DAY_IN_WEEK()',
  'FISCAL_MONTH()',
  'FISCAL_YEAR()',
  'FORMAT()',
  'TO_LABEL()',
  'CONVERT_CURRENCY()',
];

export function soqlSuggestions(
  query: string,
  caret: number,
  fields: SalesforceFieldSummary[],
): SoqlSuggestion[] {
  const { token } = tokenAt(query, caret);
  const needle = token.toLowerCase();
  if (!needle && !isFieldPosition(query, caret)) return [];

  const fieldMatches = fields
    .filter(
      (field) =>
        !needle ||
        field.name.toLowerCase().includes(needle) ||
        field.label.toLowerCase().includes(needle),
    )
    .sort((left, right) => suggestionRank(left.name, needle) - suggestionRank(right.name, needle))
    .map<SoqlSuggestion>((field) => ({
      value: field.name,
      label: field.label,
      detail: `${field.name} · ${field.type}`,
      kind: 'field',
    }));

  const clauses = CLAUSES.filter((value) =>
    value.toLowerCase().startsWith(needle),
  ).map<SoqlSuggestion>((value) => ({
    value,
    label: value,
    detail: 'SOQL clause',
    kind: 'clause',
  }));
  const functions = FUNCTIONS.filter((value) =>
    value.toLowerCase().startsWith(needle),
  ).map<SoqlSuggestion>((value) => ({
    value,
    label: value,
    detail: 'SOQL function',
    kind: 'function',
  }));

  return (
    isFieldPosition(query, caret)
      ? [...fieldMatches, ...functions, ...clauses]
      : [...clauses, ...functions, ...fieldMatches]
  ).slice(0, 14);
}

export function applySoqlSuggestion(
  query: string,
  caret: number,
  suggestion: SoqlSuggestion,
): { query: string; caret: number } {
  const { start, end } = tokenAt(query, caret);
  const next = `${query.slice(0, start)}${suggestion.value}${query.slice(end)}`;
  const nextCaret = start + suggestion.value.length;
  return { query: next, caret: nextCaret };
}

export function objectFromSoql(query: string): string | undefined {
  return /\bFROM\s+([A-Za-z][A-Za-z0-9_]*)/i.exec(query)?.[1];
}

function tokenAt(query: string, caret: number): { token: string; start: number; end: number } {
  const safeCaret = Math.max(0, Math.min(caret, query.length));
  let start = safeCaret;
  let end = safeCaret;
  while (start > 0 && /[A-Za-z0-9_.]/.test(query[start - 1] ?? '')) start -= 1;
  while (end < query.length && /[A-Za-z0-9_.]/.test(query[end] ?? '')) end += 1;
  return { token: query.slice(start, safeCaret), start, end };
}

function isFieldPosition(query: string, caret: number): boolean {
  const before = query.slice(0, caret);
  const select = before.toUpperCase().lastIndexOf('SELECT');
  const from = before.toUpperCase().lastIndexOf('FROM');
  if (select > from) return true;
  return /(?:WHERE|AND|OR|ORDER\s+BY|GROUP\s+BY|HAVING)\s+[A-Za-z0-9_.]*$/i.test(before);
}

function suggestionRank(value: string, needle: string): number {
  const normalized = value.toLowerCase();
  if (!needle) return 2;
  if (normalized === needle) return 0;
  if (normalized.startsWith(needle)) return 1;
  return 2;
}
