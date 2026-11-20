import type { OrgIdentity, SalesforceTabInfo } from '@varkole/shared';

export function salesforceTabUrl(org: OrgIdentity, tab: SalesforceTabInfo): string | undefined {
  const path =
    tab.url ??
    (tab.sobjectName
      ? `/lightning/o/${encodeURIComponent(tab.sobjectName)}/list`
      : tab.name
        ? `/lightning/n/${encodeURIComponent(tab.name)}`
        : undefined);
  if (!path) return undefined;
  try {
    const base = new URL(org.instanceUrl);
    const url = new URL(path, base);
    return isTrustedSalesforceHost(url.hostname) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function isTrustedSalesforceHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return [
    '.salesforce.com',
    '.salesforce-setup.com',
    '.force.com',
    '.cloudforce.com',
    '.visualforce.com',
  ].some((suffix) => host.endsWith(suffix));
}
