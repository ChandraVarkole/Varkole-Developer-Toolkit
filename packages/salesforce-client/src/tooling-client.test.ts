import { describe, expect, it, vi } from 'vitest';
import { SalesforceToolingClient } from './tooling-client';
import { SalesforceTransport } from './transport';

describe('SalesforceToolingClient execute anonymous', () => {
  it('encodes Apex and does not retry a write-capable execution', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify([{ errorCode: 'SERVER_ERROR', message: 'failed' }]), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const client = new SalesforceToolingClient({
      transport: new SalesforceTransport({
        instanceUrl: 'https://acme.my.salesforce.com',
        accessToken: 'secret-token',
        fetchImpl,
      }),
      apiVersion: '68.0',
    });

    await expect(client.executeAnonymous("System.debug('hello');")).rejects.toThrow('failed');
    expect(fetchImpl).toHaveBeenCalledOnce();
    const requestedUrl = fetchImpl.mock.calls[0]?.[0];
    expect(requestedUrl instanceof URL ? requestedUrl.toString() : '').toContain(
      'tooling/executeAnonymous?anonymousBody=System.debug',
    );
  });
});

describe('SalesforceToolingClient debug logs', () => {
  it('retrieves an ApexLog body through Tooling API as plain text', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('USER_DEBUG|hello', { status: 200 }));
    const client = new SalesforceToolingClient({
      transport: new SalesforceTransport({
        instanceUrl: 'https://acme.my.salesforce.com',
        accessToken: 'secret-token',
        fetchImpl,
      }),
      apiVersion: '68.0',
    });

    await expect(client.getApexLogBody('07L000000000001')).resolves.toBe('USER_DEBUG|hello');
    const requestedUrl = fetchImpl.mock.calls[0]?.[0];
    expect(requestedUrl instanceof URL ? requestedUrl.pathname : '').toBe(
      '/services/data/v68.0/tooling/sobjects/ApexLog/07L000000000001/Body',
    );
  });
});

describe('SalesforceToolingClient code query pagination', () => {
  it('continues only through Tooling API query URLs', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ totalSize: 1, done: true, records: [] }), {
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const client = new SalesforceToolingClient({
      transport: new SalesforceTransport({
        instanceUrl: 'https://acme.my.salesforce.com',
        accessToken: 'secret-token',
        fetchImpl,
      }),
      apiVersion: '68.0',
    });

    await expect(
      client.queryNext('/services/data/v68.0/tooling/query/01g-next'),
    ).resolves.toMatchObject({ done: true, records: [] });
    await expect(client.queryNext('/services/data/v68.0/query/01g-next')).rejects.toThrow(
      'Tooling pagination',
    );
  });
});
