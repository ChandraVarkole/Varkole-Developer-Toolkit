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
});
