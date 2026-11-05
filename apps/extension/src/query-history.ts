import type { ApiMode, SoqlHistoryEntry } from '@varkole/shared';

export const QUERY_HISTORY_LIMIT = 50;

export function addQueryHistoryEntry(
  history: SoqlHistoryEntry[],
  input: { soql: string; mode: ApiMode; id: string; executedAt: string },
): SoqlHistoryEntry[] {
  const soql = input.soql.trim();
  if (!soql) return history.slice(0, QUERY_HISTORY_LIMIT);
  const entry: SoqlHistoryEntry = {
    id: input.id,
    soql,
    mode: input.mode,
    executedAt: input.executedAt,
  };
  return [
    entry,
    ...history.filter((candidate) => candidate.soql !== soql || candidate.mode !== input.mode),
  ].slice(0, QUERY_HISTORY_LIMIT);
}
