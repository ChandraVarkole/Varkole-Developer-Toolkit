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
});
