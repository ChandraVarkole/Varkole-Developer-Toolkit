import type { MetadataFileProperty } from '@varkole/shared';
import type { SalesforceTransport } from './transport';

export class SalesforceMetadataClient {
  private readonly transport: SalesforceTransport;
  private readonly apiVersion: string;

  constructor(options: { transport: SalesforceTransport; apiVersion: string }) {
    this.transport = options.transport;
    this.apiVersion = options.apiVersion;
  }

  async listExternalClientApplications(signal?: AbortSignal): Promise<MetadataFileProperty[]> {
    const result = await this.transport.postMetadataSoap(
      `/services/Soap/m/${this.apiVersion}`,
      'listMetadata',
      `<met:listMetadata><met:queries><met:type>ExternalClientApplication</met:type></met:queries><met:asOfVersion>${escapeXml(this.apiVersion)}</met:asOfVersion></met:listMetadata>`,
      signal,
    );
    return parseMetadataFileProperties(result.data);
  }
}

export function parseMetadataFileProperties(xml: string): MetadataFileProperty[] {
  const results: MetadataFileProperty[] = [];
  const blocks = xml.matchAll(/<(?:\w+:)?result(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?result>/gi);
  for (const block of blocks) {
    const body = block[1] ?? '';
    const fullName = readTag(body, 'fullName');
    if (!fullName) continue;
    const type = readTag(body, 'type') ?? 'ExternalClientApplication';
    const namespacePrefix = readTag(body, 'namespacePrefix');
    const manageableState = readTag(body, 'manageableState');
    const lastModifiedDate = readTag(body, 'lastModifiedDate');
    results.push({
      fullName,
      type,
      ...(namespacePrefix ? { namespacePrefix } : {}),
      ...(manageableState ? { manageableState } : {}),
      ...(lastModifiedDate ? { lastModifiedDate } : {}),
    });
  }
  return results.sort((left, right) =>
    left.fullName.localeCompare(right.fullName, undefined, { sensitivity: 'base', numeric: true }),
  );
}

function readTag(xml: string, tag: string): string | undefined {
  const match = xml.match(new RegExp(`<(?:\\w+:)?${tag}>([\\s\\S]*?)<\\/(?:\\w+:)?${tag}>`, 'i'));
  return match?.[1] ? decodeXml(match[1].trim()) : undefined;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}
