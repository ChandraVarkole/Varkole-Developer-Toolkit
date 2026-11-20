import type { SalesforceObjectSummary } from '@varkole/shared';

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

export function objectDisplayLabel(object: SalesforceObjectSummary): string {
  const label = typeof object.label === 'string' ? object.label.trim() : '';
  return !label || /^missing label$/i.test(label) ? object.name : label;
}

export function objectSelectionLabel(
  object: SalesforceObjectSummary,
  objects: SalesforceObjectSummary[],
): string {
  const label = objectDisplayLabel(object);
  const duplicateLabel = objects.some(
    (candidate) =>
      candidate.name !== object.name &&
      objectDisplayLabel(candidate).localeCompare(label, undefined, { sensitivity: 'base' }) === 0,
  );
  return duplicateLabel || label !== object.name ? `${label} (${object.name})` : object.name;
}

export function sortSalesforceObjects(
  objects: SalesforceObjectSummary[],
): SalesforceObjectSummary[] {
  return [...objects].sort((left, right) => {
    const labelOrder = collator.compare(objectDisplayLabel(left), objectDisplayLabel(right));
    return labelOrder || collator.compare(left.name, right.name);
  });
}

export function sortSalesforceObjectsDescending(
  objects: SalesforceObjectSummary[],
): SalesforceObjectSummary[] {
  return [...objects].sort((left, right) => {
    const leftLabel = objectDisplayLabel(left);
    const rightLabel = objectDisplayLabel(right);
    const leftStandard = /^[A-Za-z0-9]/.test(leftLabel);
    const rightStandard = /^[A-Za-z0-9]/.test(rightLabel);
    if (leftStandard !== rightStandard) return leftStandard ? -1 : 1;
    const labelOrder = collator.compare(rightLabel, leftLabel);
    return labelOrder || collator.compare(right.name, left.name);
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

export function objectSearchInputState(value: string): {
  draft: string;
  showSuggestions: boolean;
  clearSelection: boolean;
} {
  const trimmed = value.trim();
  return {
    draft: value,
    showSuggestions: trimmed.length >= 2,
    clearSelection: trimmed.length === 0,
  };
}
