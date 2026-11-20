export function updateSoqlForObjectChange(
  currentSoql: string,
  previousObject: string,
  nextObject: string,
): string {
  const objectName = nextObject.trim();
  if (!objectName) return '';
  if (
    currentSoql.trim() &&
    previousObject &&
    previousObject.toLowerCase() === objectName.toLowerCase()
  ) {
    return currentSoql;
  }
  return `SELECT Id\nFROM ${objectName}\nLIMIT 100`;
}

export function mergeBuilderFieldsIntoSoql(
  currentSoql: string,
  objectApiName: string,
  selectedFields: string[],
): string {
  const objectName = objectApiName.trim();
  const fields = uniqueFields(selectedFields);
  if (!objectName || fields.length === 0) return currentSoql;

  const match = currentSoql.match(/^\s*SELECT\s+([\s\S]*?)\s+FROM\s+([A-Za-z][A-Za-z0-9_]*)\b/i);
  if (!match || match[2]?.toLowerCase() !== objectName.toLowerCase()) {
    return `SELECT ${fields.join(', ')}\nFROM ${objectName}\nLIMIT 100`;
  }

  const existingSelection = match[1] ?? '';
  const existingFields = splitSelectFields(existingSelection);
  const merged = uniqueFields([...existingFields, ...fields]);
  const selectionStart = currentSoql.indexOf(existingSelection);
  return `${currentSoql.slice(0, selectionStart)}${merged.join(', ')}${currentSoql.slice(
    selectionStart + existingSelection.length,
  )}`;
}

function splitSelectFields(selection: string): string[] {
  const fields: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < selection.length; index += 1) {
    const character = selection[index];
    if (character === '(') depth += 1;
    if (character === ')') depth = Math.max(0, depth - 1);
    if (character === ',' && depth === 0) {
      fields.push(selection.slice(start, index).trim());
      start = index + 1;
    }
  }
  fields.push(selection.slice(start).trim());
  return fields.filter(Boolean);
}

function uniqueFields(fields: string[]): string[] {
  const seen = new Set<string>();
  return fields
    .map((field) => field.trim())
    .filter((field) => {
      if (!field) return false;
      const key = field.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
