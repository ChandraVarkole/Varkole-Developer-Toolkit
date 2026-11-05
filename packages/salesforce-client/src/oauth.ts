import { AppError } from '@varkole/shared';

const SALESFORCE_HOST_SUFFIXES = [
  '.salesforce.com',
  '.salesforce-setup.com',
  '.force.com',
  '.cloudforce.com',
  '.visualforce.com',
] as const;

export function normalizeSalesforceLoginUrl(value: string): string {
  const candidate = value.includes('://') ? value : `https://${value}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw invalidHost();
  }
  if (
    url.protocol !== 'https:' ||
    url.username !== '' ||
    url.password !== '' ||
    url.port !== '' ||
    url.pathname !== '/' ||
    url.search !== '' ||
    url.hash !== '' ||
    !isSalesforceHostname(url.hostname)
  ) {
    throw invalidHost();
  }
  return url.origin;
}

export function isSalesforceHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  return SALESFORCE_HOST_SUFFIXES.some(
    (suffix) => host.endsWith(suffix) && host.length > suffix.length,
  );
}

export function validateSalesforceUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !isSalesforceHostname(url.hostname)) throw invalidHost();
  return url;
}

function invalidHost(): AppError {
  return new AppError({
    code: 'INVALID_HOST',
    message: 'Enter a valid HTTPS Salesforce domain.',
    detail:
      'Only supported Salesforce-owned salesforce.com, salesforce-setup.com, force.com, cloudforce.com, and visualforce.com hosts are allowed.',
    retryable: false,
  });
}

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function randomBase64Url(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

export async function createPkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = randomBase64Url(64);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, challenge: base64UrlEncode(new Uint8Array(digest)) };
}

export function validateOAuthCallback(
  callback: string,
  expectedRedirect: string,
  expectedState: string,
): { code: string } {
  const received = new URL(callback);
  const expected = new URL(expectedRedirect);
  if (received.origin !== expected.origin || received.pathname !== expected.pathname) {
    throw new AppError({
      code: 'INVALID_REQUEST',
      message: 'Salesforce returned to an unexpected redirect address.',
      retryable: false,
    });
  }
  if (received.searchParams.get('state') !== expectedState) {
    throw new AppError({
      code: 'INVALID_REQUEST',
      message: 'The OAuth state did not match. Please start the connection again.',
      retryable: false,
    });
  }
  const oauthError = received.searchParams.get('error');
  if (oauthError) {
    throw new AppError({
      code: oauthError === 'access_denied' ? 'AUTH_CANCELLED' : 'SALESFORCE',
      message:
        oauthError === 'access_denied'
          ? 'Salesforce authorization was cancelled.'
          : 'Salesforce could not authorize this connection.',
      detail: received.searchParams.get('error_description') ?? oauthError,
      retryable: true,
    });
  }
  const code = received.searchParams.get('code');
  if (!code) {
    throw new AppError({
      code: 'INVALID_REQUEST',
      message: 'Salesforce did not return an authorization code.',
      retryable: true,
    });
  }
  return { code };
}
