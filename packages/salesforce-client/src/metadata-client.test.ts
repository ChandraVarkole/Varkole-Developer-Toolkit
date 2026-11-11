import { describe, expect, it, vi } from 'vitest';
import { SalesforceMetadataClient, parseMetadataFileProperties } from './metadata-client';
import { SalesforceTransport } from './transport';

describe('SalesforceMetadataClient', () => {
  it('lists and alphabetizes external client application metadata', async () => {
    const response = `<?xml version="1.0" encoding="UTF-8"?>
      <env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/">
        <env:Body><listMetadataResponse xmlns="http://soap.sforce.com/2006/04/metadata">
          <result><fullName>Zeta_App</fullName><lastModifiedDate>2026-01-02T00:00:00.000Z</lastModifiedDate><manageableState>unmanaged</manageableState><type>ExternalClientApplication</type></result>
          <result><fullName>Acme_App</fullName><namespacePrefix>acme</namespacePrefix><manageableState>installed</manageableState><type>ExternalClientApplication</type></result>
        </listMetadataResponse></env:Body>
      </env:Envelope>`;
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(response, { headers: { 'Content-Type': 'text/xml' } }));
    const client = new SalesforceMetadataClient({
      transport: new SalesforceTransport({
        instanceUrl: 'https://acme.my.salesforce.com',
        accessToken: 'secret-token',
        fetchImpl,
      }),
      apiVersion: '68.0',
    });

    await expect(client.listExternalClientApplications()).resolves.toEqual([
      {
        fullName: 'Acme_App',
        namespacePrefix: 'acme',
        manageableState: 'installed',
        type: 'ExternalClientApplication',
      },
      {
        fullName: 'Zeta_App',
        manageableState: 'unmanaged',
        lastModifiedDate: '2026-01-02T00:00:00.000Z',
        type: 'ExternalClientApplication',
      },
    ]);
    const requestedUrl = fetchImpl.mock.calls[0]?.[0];
    const request = fetchImpl.mock.calls[0]?.[1];
    expect(requestedUrl instanceof URL ? requestedUrl.pathname : '').toBe('/services/Soap/m/68.0');
    const requestBody = typeof request?.body === 'string' ? request.body : '';
    expect(requestBody).toContain('<met:type>ExternalClientApplication</met:type>');
    expect(requestBody).toContain('<met:sessionId>secret-token</met:sessionId>');
  });

  it('returns an empty inventory for an empty Metadata API result', () => {
    expect(parseMetadataFileProperties('<result xsi:nil="true"/>')).toEqual([]);
  });
});
