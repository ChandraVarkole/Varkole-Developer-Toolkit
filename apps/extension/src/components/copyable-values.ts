export function isCopyableTechnicalValue(column: string, value: string): boolean {
  if (!value) return false;
  const trimmed = value.trimStart();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return true;
  const leaf = column.split('.').at(-1) ?? column;
  if (/email|(^|\s)name$/i.test(leaf) && !/username/i.test(leaf)) return false;
  if (
    /^(username|apiName|developerName|namespace|namespacePrefix|instanceUrl|url)$/i.test(leaf) ||
    /(?:^|_)id$/i.test(leaf) ||
    /Id$/.test(leaf)
  ) {
    return true;
  }
  return false;
}
