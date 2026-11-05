import type { QueryPage, QueryRecord } from '@varkole/shared';

export function addCoveragePercentages(page: QueryPage): QueryPage {
  return {
    ...page,
    records: page.records.map(addCoveragePercentage),
  };
}

export function addCoveragePercentage(record: QueryRecord): QueryRecord {
  const covered = numericValue(record.NumLinesCovered);
  const uncovered = numericValue(record.NumLinesUncovered);
  const total = covered + uncovered;
  const percentage = total > 0 ? (covered / total) * 100 : 0;
  const relationship = record.ApexClassOrTrigger;
  const name =
    relationship && typeof relationship === 'object' && 'Name' in relationship
      ? (relationship as Record<string, unknown>).Name
      : record['ApexClassOrTrigger.Name'];
  return {
    Name: typeof name === 'string' ? name : '',
    Coverage: `${percentage.toFixed(2)}%`,
    CoveredLines: covered,
    UncoveredLines: uncovered,
    TotalLines: total,
  };
}

function numericValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
