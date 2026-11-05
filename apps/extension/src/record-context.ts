const RECORD_ID = /^[A-Za-z0-9]{15}(?:[A-Za-z0-9]{3})?$/;

export function recordIdFromSalesforceUrl(value: string): string | undefined {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return undefined;
  }

  const route = `${url.pathname}${url.hash}`;
  const lightning = route.match(
    /\/lightning\/r\/(?:[A-Za-z][A-Za-z0-9_]*\/)?([A-Za-z0-9]{15}(?:[A-Za-z0-9]{3})?)(?:\/|$)/,
  )?.[1];
  if (lightning && RECORD_ID.test(lightning)) return lightning;

  return route
    .split(/[/?#]/)
    .find((segment) => RECORD_ID.test(segment) && !segment.startsWith('00D'));
}
