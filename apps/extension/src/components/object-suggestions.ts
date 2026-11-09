import type { SalesforceObjectSummary } from '@varkole/shared';

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

export function objectDisplayLabel(object: SalesforceObjectSummary): string {
  const label = typeof object.label === 'string' ? object.label.trim() : '';
  return !label || /^missing label$/i.test(label) ? object.name : label;
}

export function sortSalesforceObjects(
  objects: SalesforceObjectSummary[],
): SalesforceObjectSummary[] {
  return [...objects].sort((left, right) => {
    const labelOrder = collator.compare(objectDisplayLabel(left), objectDisplayLabel(right));
    return labelOrder || collator.compare(left.name, right.name);
  });
}

export function matchingObjectSuggestions(
  objects: SalesforceObjectSummary[],
  input: string,
  limit = 50,
): SalesforceObjectSummary[] {
  const needle = input.trim().toLowerCase();
  if (needle.length < 2) return [];
  return sortSalesforceObjects(objects)
    .filter(
      (object) =>
        object.name.toLowerCase().includes(needle) ||
        objectDisplayLabel(object).toLowerCase().includes(needle),
    )
    .slice(0, limit);
}
