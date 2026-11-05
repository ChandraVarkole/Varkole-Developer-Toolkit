export interface SalesforceSessionCookie {
  domain: string;
  value: string;
}

export function selectApiSessionCookie<T extends SalesforceSessionCookie>(
  cookies: T[],
  orgId: string,
  fallback?: T,
): T | undefined {
  const candidates = cookies
    .filter((cookie) => cookieMatchesOrg(cookie, orgId) && isApiCapableCookieDomain(cookie.domain))
    .sort((left, right) => apiCookieScore(right) - apiCookieScore(left));
  return (
    candidates[0] ??
    (fallback && cookieMatchesOrg(fallback, orgId) && isApiCapableCookieDomain(fallback.domain)
      ? fallback
      : undefined)
  );
}

export function cookieMatchesOrg(cookie: SalesforceSessionCookie, orgId: string): boolean {
  const separator = cookie.value.indexOf('!');
  if (separator < 0) return false;

  const cookieOrgId = cookie.value.slice(0, separator);
  return cookieOrgId === orgId || cookieOrgId.slice(0, 15) === orgId.slice(0, 15);
}

export function normalizeSalesforceApiHost(hostname: string): string {
  return hostname
    .toLowerCase()
    .replace(/^\./, '')
    .replace(/\.lightning\.force\./, '.my.salesforce.')
    .replace(/\.lightning\.([^.]+)\.force\.com$/, '.my.$1.salesforce.com')
    .replace(/\.my\.salesforce-setup\.com$/, '.my.salesforce.com')
    .replace(/\.mcas\.ms$/, '');
}

function isApiCapableCookieDomain(domain: string): boolean {
  const normalized = domain.toLowerCase().replace(/^\./, '');
  return (
    normalized !== 'help.salesforce.com' &&
    !normalized.endsWith('.visualforce.com') &&
    !normalized.includes('.lightning.force.com') &&
    !normalized.includes('.salesforce-setup.com')
  );
}

function apiCookieScore(cookie: SalesforceSessionCookie): number {
  const domain = cookie.domain.toLowerCase();
  if (domain.includes('.my.salesforce.com')) return 300 + domain.length;
  if (domain.endsWith('.salesforce.com')) return 200 + domain.length;
  if (domain.endsWith('.cloudforce.com')) return 150 + domain.length;
  if (domain.endsWith('.force.com')) return 100 + domain.length;
  return domain.length;
}
