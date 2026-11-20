const RECORD_ID = /^[A-Za-z0-9]{15}(?:[A-Za-z0-9]{3})?$/;
const DIRECT_RECORD_PARAMETERS = ['id', 'recordId', 'record', 'eid'] as const;
const ROUTE_PARAMETERS = ['address', 'retURL', 'saveURL', 'cancelURL'] as const;

export function recordIdFromSalesforceUrl(value: string): string | undefined {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return undefined;
  }

  for (const parameter of DIRECT_RECORD_PARAMETERS) {
    const candidate = url.searchParams.get(parameter);
    if (candidate && isRecordId(candidate)) return candidate;
  }

  const routes = [`${url.pathname}${url.hash}`];
  for (const parameter of ROUTE_PARAMETERS) {
    const candidate = url.searchParams.get(parameter);
    if (candidate) routes.push(candidate);
  }

  for (const route of routes.flatMap(decodedRouteVariants)) {
    const lightning = route.match(
      /\/lightning\/r\/(?:[A-Za-z][A-Za-z0-9_]*\/)?([A-Za-z0-9]{15}(?:[A-Za-z0-9]{3})?)(?:\/|$)/,
    )?.[1];
    if (lightning && isRecordId(lightning)) return lightning;

    const classic = route.split(/[/?#&=]/).find(isRecordId);
    if (classic) return classic;
  }

  return undefined;
}

function decodedRouteVariants(value: string): string[] {
  const variants = [value];
  let current = value;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const decoded = decodeURIComponent(current);
      if (decoded === current) break;
      variants.push(decoded);
      current = decoded;
    } catch {
      break;
    }
  }
  return variants;
}

function isRecordId(value: string): boolean {
  return RECORD_ID.test(value) && !value.startsWith('00D');
}
