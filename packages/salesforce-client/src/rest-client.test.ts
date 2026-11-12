import { describe, expect, it, vi } from 'vitest';
import { SalesforceRestClient } from './rest-client';
import { SalesforceTransport } from './transport';

describe('SalesforceRestClient describe', () => {
  it('preserves direct child relationship metadata for relationship-aware retrieval', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          name: 'Contact',
          label: 'Contact',
          fields: [],
          childRelationships: [
            {
              childSObject: 'Case',
              field: 'ContactId',
              relationshipName: 'Cases',
              cascadeDelete: false,
              restrictedDelete: false,
            },
            {
              childSObject: 'ContactChangeEvent',
              field: 'RecordId',
              relationshipName: null,
              cascadeDelete: false,
            },
          ],
        }),
        { headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const client = new SalesforceRestClient({
      transport: new SalesforceTransport({
        instanceUrl: 'https://acme.my.salesforce.com',
        accessToken: 'secret',
        fetchImpl,
      }),
      apiVersion: '68.0',
    });

    await expect(client.describeObject('Contact')).resolves.toMatchObject({
      childRelationships: [
        {
          childSObject: 'Case',
          field: 'ContactId',
          relationshipName: 'Cases',
          cascadeDelete: false,
          restrictedDelete: false,
        },
      ],
    });
  });

  it('sorts objects A–Z and replaces missing labels with API names', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          sobjects: [
            {
              name: 'Zulu__c',
              label: 'Missing Label',
              custom: true,
              queryable: true,
              searchable: true,
            },
            {
              name: 'Account',
              label: 'Accounts',
              custom: false,
              queryable: true,
              searchable: true,
            },
          ],
        }),
        { headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const client = new SalesforceRestClient({
      transport: new SalesforceTransport({
        instanceUrl: 'https://acme.my.salesforce.com',
        accessToken: 'secret',
        fetchImpl,
      }),
      apiVersion: '68.0',
    });

    await expect(client.listObjects()).resolves.toMatchObject([
      { name: 'Account', label: 'Accounts' },
      { name: 'Zulu__c', label: 'Zulu__c' },
    ]);
  });

  it('inspects every accessible field on a custom record through dedicated record APIs', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation((input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/ui-api/records/')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ id: 'a001G00000ABCdeQAH', apiName: 'Invoice__c', fields: {} }),
            { headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }
      if (url.endsWith('/sobjects/Invoice__c/describe')) {
        return Promise.resolve(
          new Response(JSON.stringify({ name: 'Invoice__c', label: 'Invoice', fields: [] }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify({ Id: 'a001G00000ABCdeQAH', Name: 'INV-100', Total__c: 125 }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });
    const client = new SalesforceRestClient({
      transport: new SalesforceTransport({
        instanceUrl: 'https://acme.my.salesforce.com',
        accessToken: 'secret',
        fetchImpl,
      }),
      apiVersion: '68.0',
    });

    await expect(client.inspectRecord('a001G00000ABCdeQAH')).resolves.toMatchObject({
      objectApiName: 'Invoice__c',
      describe: { name: 'Invoice__c', label: 'Invoice' },
      record: { Id: 'a001G00000ABCdeQAH', Name: 'INV-100', Total__c: 125 },
    });
    const urls = fetchImpl.mock.calls.map(([input]) =>
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
    );
    expect(urls).toContain(
      'https://acme.my.salesforce.com/services/data/v68.0/sobjects/Invoice__c/a001G00000ABCdeQAH',
    );
  });

  it('falls back to the global key-prefix map when UI API resolution is unavailable', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation((input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/ui-api/records/')) {
        return Promise.resolve(
          new Response(JSON.stringify([{ errorCode: 'NOT_FOUND', message: 'Unavailable' }]), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }
      if (url.endsWith('/sobjects')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              sobjects: [
                {
                  name: 'Invoice__c',
                  label: 'Invoice',
                  keyPrefix: 'a00',
                  custom: true,
                  queryable: true,
                  searchable: true,
                },
              ],
            }),
            { headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }
      if (url.endsWith('/describe')) {
        return Promise.resolve(
          new Response(JSON.stringify({ name: 'Invoice__c', label: 'Invoice', fields: [] }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify({ Id: 'a001G00000ABCdeQAH', Name: 'INV-100' }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });
    const client = new SalesforceRestClient({
      transport: new SalesforceTransport({
        instanceUrl: 'https://acme.my.salesforce.com',
        accessToken: 'secret',
        fetchImpl,
      }),
      apiVersion: '68.0',
    });

    await expect(client.inspectRecord('a001G00000ABCdeQAH')).resolves.toMatchObject({
      objectApiName: 'Invoice__c',
      record: { Name: 'INV-100' },
    });
  });

  it('reads report and dashboard analytics through bounded read-only endpoints', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
    const client = new SalesforceRestClient({
      transport: new SalesforceTransport({
        instanceUrl: 'https://acme.my.salesforce.com',
        accessToken: 'secret',
        fetchImpl,
      }),
      apiVersion: '68.0',
    });

    await client.getReportResult('00O000000000001AAA');
    await client.getDashboardResult('01Z000000000001AAA');

    const reportRequest = fetchImpl.mock.calls[0]?.[0];
    const dashboardRequest = fetchImpl.mock.calls[1]?.[0];
    const reportUrl =
      typeof reportRequest === 'string'
        ? reportRequest
        : reportRequest instanceof URL
          ? reportRequest.href
          : reportRequest?.url;
    const dashboardUrl =
      typeof dashboardRequest === 'string'
        ? dashboardRequest
        : dashboardRequest instanceof URL
          ? dashboardRequest.href
          : dashboardRequest?.url;
    expect(reportUrl).toContain(
      '/services/data/v68.0/analytics/reports/00O000000000001AAA?includeDetails=true',
    );
    expect(dashboardUrl).toContain('/services/data/v68.0/analytics/dashboards/01Z000000000001AAA');
    await expect(client.getReportResult('001000000000001AAA')).rejects.toThrow('report ID');
    await expect(client.getDashboardResult('001000000000001AAA')).rejects.toThrow('dashboard ID');
  });

  it('creates, updates, and deletes records through composite collection endpoints', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () =>
      Promise.resolve(
        new Response(JSON.stringify([{ success: true, id: '001000000000001AAA', errors: [] }]), {
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
    const client = new SalesforceRestClient({
      transport: new SalesforceTransport({
        instanceUrl: 'https://acme.my.salesforce.com',
        accessToken: 'secret',
        fetchImpl,
      }),
      apiVersion: '68.0',
    });

    await client.importRecords('Account', 'insert', [{ Name: 'New account' }]);
    await client.importRecords('Account', 'update', [
      { Id: '001000000000001AAA', Name: 'Updated account' },
    ]);
    await client.importRecords('Account', 'delete', [{ Id: '001000000000001AAA' }]);

    const calls = fetchImpl.mock.calls.map(([input, request]) => ({
      url: typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
      method: request?.method,
      body: request?.body,
    }));
    expect(calls[0]).toMatchObject({
      url: 'https://acme.my.salesforce.com/services/data/v68.0/composite/sobjects',
      method: 'POST',
    });
    const insertBody = calls[0]?.body;
    if (typeof insertBody !== 'string') throw new Error('Expected a JSON request body.');
    expect(JSON.parse(insertBody)).toEqual({
      allOrNone: false,
      records: [{ attributes: { type: 'Account' }, Name: 'New account' }],
    });
    expect(calls[1]?.method).toBe('PATCH');
    expect(calls[2]).toMatchObject({
      url: 'https://acme.my.salesforce.com/services/data/v68.0/composite/sobjects?ids=001000000000001AAA&allOrNone=false',
      method: 'DELETE',
    });
  });

  it('adds the latest Salesforce release label and API version to org info', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation((input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.endsWith('/services/data/')) {
        return Promise.resolve(
          new Response(
            JSON.stringify([
              { label: "Winter '26", url: '/services/data/v65.0', version: '65.0' },
              { label: "Spring '26", url: '/services/data/v66.0', version: '66.0' },
            ]),
            { headers: { 'Content-Type': 'application/json' } },
          ),
        );
      }
      if (url.endsWith('/limits')) {
        return Promise.resolve(
          new Response(JSON.stringify({}), {
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            totalSize: 1,
            done: true,
            records: [
              {
                Id: '00D000000000001AAA',
                Name: 'Acme',
                OrganizationType: 'Enterprise Edition',
                InstanceName: 'NA1',
                IsSandbox: false,
              },
            ],
          }),
          { headers: { 'Content-Type': 'application/json' } },
        ),
      );
    });
    const client = new SalesforceRestClient({
      transport: new SalesforceTransport({
        instanceUrl: 'https://acme.my.salesforce.com',
        accessToken: 'secret',
        fetchImpl,
      }),
      apiVersion: '65.0',
    });

    await expect(
      client.orgInfo(
        {
          username: 'dev@example.com',
          displayName: 'Developer',
          instanceUrl: 'https://acme.my.salesforce.com',
        },
        '65.0',
      ),
    ).resolves.toMatchObject({
      releaseName: "Spring '26",
      latestApiVersion: '66.0',
    });
  });
});
