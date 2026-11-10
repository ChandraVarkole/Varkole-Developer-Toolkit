import type { OrgIdentity, SalesforceTabInfo } from '@varkole/shared';

export function salesforceTabUrl(org: OrgIdentity, tab: SalesforceTabInfo): string | undefined {
  const path =
    tab.url ??
    (tab.sobjectName ? `/lightning/o/${encodeURIComponent(tab.sobjectName)}/list` : undefined);
  if (!path) return undefined;
  try {
    const base = new URL(org.instanceUrl);
    const url = new URL(path, base);
    return url.origin === base.origin ? url.href : undefined;
  } catch {
    return undefined;
  }
}
