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

describe('SalesforceToolingClient asynchronous Apex tests', () => {
  it('submits every Apex test with code coverage through the test runner', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify('707000000000001AAA'), {
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

    await expect(client.runAllApexTests()).resolves.toEqual({
      jobId: '707000000000001AAA',
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [requestedUrl, request] = fetchImpl.mock.calls[0] ?? [];
    expect(requestedUrl instanceof URL ? requestedUrl.pathname : '').toBe(
      '/services/data/v68.0/tooling/runTestsAsynchronous/',
    );
    expect(request).toMatchObject({ method: 'POST' });
    if (typeof request?.body !== 'string') throw new Error('Expected a JSON request body.');
    expect(JSON.parse(request.body)).toEqual({
      testLevel: 'RunAllTestsInOrg',
      testCategories: ['Apex'],
      skipCodeCoverage: 'false',
    });
  });

  it('rejects a malformed asynchronous job response', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify('not-a-job'), {
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

    await expect(client.runAllApexTests()).rejects.toThrow('valid asynchronous Apex test job ID');
  });

  it('normalizes an object-shaped asynchronous job response', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ id: '707000000000002AAA' }), {
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

    await expect(client.runAllApexTests()).resolves.toEqual({
      jobId: '707000000000002AAA',
    });
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

describe('SalesforceToolingClient developer search', () => {
  it('runs SOSL through the Tooling API search endpoint', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          searchRecords: [
            {
              attributes: { type: 'ApexClass' },
              Id: '01p000000000001AAA',
              Name: 'AddressSyncService',
            },
          ],
        }),
        { headers: { 'Content-Type': 'application/json' } },
      ),
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
      client.search('FIND {address*} RETURNING ApexClass(Id, Name)'),
    ).resolves.toMatchObject({
      totalSize: 1,
      done: true,
      records: [expect.objectContaining({ Name: 'AddressSyncService' })],
    });
    const requestedUrl = fetchImpl.mock.calls[0]?.[0];
    expect(requestedUrl instanceof URL ? requestedUrl.pathname : '').toBe(
      '/services/data/v68.0/tooling/search/',
    );
  });
});
