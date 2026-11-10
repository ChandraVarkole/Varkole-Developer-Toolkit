import { afterEach, describe, expect, it, vi } from 'vitest';
import { SalesforceTransport } from './transport';

describe('SalesforceTransport', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('adds bearer auth and returns API usage without exposing the token', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json', 'Sforce-Limit-Info': 'api-usage=2/100' },
      }),
    );
    const transport = new SalesforceTransport({
      instanceUrl: 'https://acme.my.salesforce.com',
      accessToken: 'secret-token',
      fetchImpl,
    });
    await expect(transport.get('/services/data/v68.0/limits')).resolves.toEqual({
      data: { ok: true },
      apiUsage: 'api-usage=2/100',
    });
    const [, request] = fetchImpl.mock.calls[0] ?? [];
    expect((request?.headers as Record<string, string>).Authorization).toBe('Bearer secret-token');
  });

  it('rejects cross-org pagination URLs', async () => {
    const transport = new SalesforceTransport({
      instanceUrl: 'https://acme.my.salesforce.com',
      accessToken: 'secret-token',
      fetchImpl: vi.fn(),
    });
    await expect(
      transport.get('https://other.my.salesforce.com/services/data/v68.0/query/next'),
    ).rejects.toThrow('change org hosts');
  });

  it('retrieves plain-text Tooling API resources with bearer auth', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response('USER_DEBUG|hello', { headers: { 'Content-Type': 'text/plain' } }),
      );
    const transport = new SalesforceTransport({
      instanceUrl: 'https://acme.my.salesforce.com',
      accessToken: 'secret-token',
      fetchImpl,
    });
    await expect(
      transport.getText('/services/data/v68.0/tooling/sobjects/ApexLog/07L000000000001/Body'),
    ).resolves.toEqual({ data: 'USER_DEBUG|hello' });
    const [, request] = fetchImpl.mock.calls[0] ?? [];
    expect((request?.headers as Record<string, string>).Accept).toBe('text/plain');
  });

  it('sends JSON writes once with the requested method and bearer auth', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify([{ success: true, id: '001000000000001AAA', errors: [] }]), {
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const transport = new SalesforceTransport({
      instanceUrl: 'https://acme.my.salesforce.com',
      accessToken: 'secret-token',
      fetchImpl,
    });

    await transport.writeJson('POST', '/services/data/v68.0/composite/sobjects', {
      allOrNone: false,
      records: [{ attributes: { type: 'Account' }, Name: 'Acme' }],
    });

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [, request] = fetchImpl.mock.calls[0] ?? [];
    expect(request).toMatchObject({
      method: 'POST',
      body: JSON.stringify({
        allOrNone: false,
        records: [{ attributes: { type: 'Account' }, Name: 'Acme' }],
      }),
    });
    expect((request?.headers as Record<string, string>).Authorization).toBe('Bearer secret-token');
  });

  it('does not automatically retry a failed write', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify([{ errorCode: 'SERVER_ERROR', message: 'failed' }]), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const transport = new SalesforceTransport({
      instanceUrl: 'https://acme.my.salesforce.com',
      accessToken: 'secret-token',
      fetchImpl,
      maxRetries: 3,
    });

    await expect(
      transport.writeJson('PATCH', '/services/data/v68.0/composite/sobjects', {}),
    ).rejects.toThrow('failed');
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('maps an invalid session to a reconnect error', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify([{ errorCode: 'INVALID_SESSION_ID', message: 'expired' }]), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const transport = new SalesforceTransport({
      instanceUrl: 'https://acme.my.salesforce.com',
      accessToken: 'secret-token',
      fetchImpl,
    });
    await expect(transport.get('/services/data/v68.0/limits')).rejects.toMatchObject({
      data: { code: 'AUTH_EXPIRED' },
    });
  });

  it('binds the browser fetch API to the global scope', async () => {
    const browserFetch = vi.fn(function (this: typeof globalThis) {
      if (this !== globalThis) throw new TypeError('Illegal invocation');
      return Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });
    vi.stubGlobal('fetch', browserFetch);

    const transport = new SalesforceTransport({
      instanceUrl: 'https://acme.my.salesforce.com',
      accessToken: 'secret-token',
    });

    await expect(transport.get('/services/data/v68.0/limits')).resolves.toEqual({
      data: { ok: true },
    });
    expect(browserFetch).toHaveBeenCalledOnce();
  });
});
