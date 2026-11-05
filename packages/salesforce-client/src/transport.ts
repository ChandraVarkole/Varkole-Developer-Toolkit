import { AppError } from '@varkole/shared';
import { validateSalesforceUrl } from './oauth';

export interface SalesforceTransportOptions {
  instanceUrl: string;
  accessToken: string;
  fetchImpl?: typeof fetch;
  maxRetries?: number;
}

export interface TransportResult<T> {
  data: T;
  apiUsage?: string;
}

interface SalesforceErrorBody {
  errorCode?: string;
  message?: string;
}

export class SalesforceTransport {
  readonly instanceUrl: string;
  private readonly accessToken: string;
  private readonly fetchImpl: typeof fetch;
  private readonly maxRetries: number;

  constructor(options: SalesforceTransportOptions) {
    this.instanceUrl = validateSalesforceUrl(options.instanceUrl).origin;
    this.accessToken = options.accessToken;
    // Browser fetch is a Web API method and must retain its WorkerGlobalScope/Window receiver.
    // Calling an unbound copy as an object property can throw `TypeError: Illegal invocation`.
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.maxRetries = options.maxRetries ?? 2;
  }

  async get<T>(
    path: string,
    signal?: AbortSignal,
    options: { retry?: boolean } = {},
  ): Promise<TransportResult<T>> {
    const url = this.resolvePath(path);
    for (let attempt = 0; ; attempt += 1) {
      const request: RequestInit = {
        method: 'GET',
        credentials: 'omit',
        headers: { Authorization: `Bearer ${this.accessToken}`, Accept: 'application/json' },
        ...(signal ? { signal } : {}),
      };
      const response = await this.fetchImpl(url, {
        ...request,
      });
      if (response.ok) {
        const apiUsage = response.headers.get('Sforce-Limit-Info');
        return {
          data: (await response.json()) as T,
          ...(apiUsage ? { apiUsage } : {}),
        };
      }
      if (
        options.retry !== false &&
        (response.status === 429 || response.status >= 500) &&
        attempt < this.maxRetries
      ) {
        await abortableDelay(Math.min(250 * 2 ** attempt, 1_000), signal);
        continue;
      }
      throw await mapSalesforceError(response);
    }
  }

  async getText(
    path: string,
    signal?: AbortSignal,
    options: { retry?: boolean } = {},
  ): Promise<TransportResult<string>> {
    const url = this.resolvePath(path);
    for (let attempt = 0; ; attempt += 1) {
      const response = await this.fetchImpl(url, {
        method: 'GET',
        credentials: 'omit',
        headers: { Authorization: `Bearer ${this.accessToken}`, Accept: 'text/plain' },
        ...(signal ? { signal } : {}),
      });
      if (response.ok) {
        const apiUsage = response.headers.get('Sforce-Limit-Info');
        return {
          data: await response.text(),
          ...(apiUsage ? { apiUsage } : {}),
        };
      }
      if (
        options.retry !== false &&
        (response.status === 429 || response.status >= 500) &&
        attempt < this.maxRetries
      ) {
        await abortableDelay(Math.min(250 * 2 ** attempt, 1_000), signal);
        continue;
      }
      throw await mapSalesforceError(response);
    }
  }

  private resolvePath(path: string): URL {
    const url = path.startsWith('https://')
      ? validateSalesforceUrl(path)
      : new URL(path, `${this.instanceUrl}/`);
    if (url.origin !== this.instanceUrl) {
      throw new AppError({
        code: 'INVALID_HOST',
        message: 'Salesforce pagination attempted to change org hosts.',
        retryable: false,
      });
    }
    return url;
  }
}

async function mapSalesforceError(response: Response): Promise<AppError> {
  let errors: SalesforceErrorBody[] = [];
  try {
    const body = (await response.json()) as SalesforceErrorBody | SalesforceErrorBody[];
    errors = Array.isArray(body) ? body : [body];
  } catch {
    // An HTML proxy response or empty body is intentionally not surfaced.
  }
  const first = errors[0];
  const code = first?.errorCode;
  if (response.status === 401 || code === 'INVALID_SESSION_ID') {
    return new AppError({
      code: 'AUTH_EXPIRED',
      message: 'Your Salesforce session expired. Reconnect this org.',
      ...(code ? { detail: code } : {}),
      status: response.status,
      retryable: true,
    });
  }
  if (response.status === 403 || code === 'INSUFFICIENT_ACCESS') {
    return new AppError({
      code: 'PERMISSION_DENIED',
      message: 'Salesforce denied this operation for the current user.',
      ...(first?.message ? { detail: first.message } : {}),
      status: response.status,
      retryable: false,
    });
  }
  if (response.status === 429) {
    return new AppError({
      code: 'RATE_LIMITED',
      message: 'Salesforce API limits are temporarily preventing this request.',
      ...(first?.message ? { detail: first.message } : {}),
      status: response.status,
      retryable: true,
    });
  }
  return new AppError({
    code: 'SALESFORCE',
    message: first?.message ?? `Salesforce returned HTTP ${response.status}.`,
    ...(code ? { detail: code } : {}),
    status: response.status,
    retryable: response.status >= 500,
  });
}

function abortableDelay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}
