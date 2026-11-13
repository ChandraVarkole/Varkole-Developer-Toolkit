import type { CustomTabMetadata, MetadataFileProperty, QuickActionMetadata } from '@varkole/shared';
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

  async readCustomTab(fullName: string, signal?: AbortSignal): Promise<CustomTabMetadata> {
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(fullName)) {
      throw new Error('Salesforce returned an invalid custom tab name.');
    }
    const result = await this.transport.postMetadataSoap(
      `/services/Soap/m/${this.apiVersion}`,
      'readMetadata',
      `<met:readMetadata><met:type>CustomTab</met:type><met:fullNames>${escapeXml(fullName)}</met:fullNames></met:readMetadata>`,
      signal,
    );
    return parseCustomTabMetadata(result.data, fullName);
  }

  async readQuickAction(fullName: string, signal?: AbortSignal): Promise<QuickActionMetadata> {
    if (!/^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)?$/.test(fullName)) {
      throw new Error('Salesforce returned an invalid quick action name.');
    }
    const result = await this.transport.postMetadataSoap(
      `/services/Soap/m/${this.apiVersion}`,
      'readMetadata',
      `<met:readMetadata><met:type>QuickAction</met:type><met:fullNames>${escapeXml(fullName)}</met:fullNames></met:readMetadata>`,
      signal,
    );
    return parseQuickActionMetadata(result.data, fullName);
  }
}

export function parseCustomTabMetadata(xml: string, requestedName: string): CustomTabMetadata {
  const record = xml.match(/<(?:\w+:)?records(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?records>/i)?.[1];
  if (!record) throw new Error(`Salesforce did not return metadata for tab ${requestedName}.`);
  const fullName = readTag(record, 'fullName') ?? requestedName;
  const label = readTag(record, 'label');
  const auraComponent = readTag(record, 'auraComponent');
  const lwcComponent = readTag(record, 'lwcComponent');
  const flexiPage = readTag(record, 'flexiPage');
  const page = readTag(record, 'page');
  const customObject = readTag(record, 'customObject');
  const url = readTag(record, 'url');
  return {
    fullName,
    ...(label ? { label } : {}),
    ...(auraComponent ? { auraComponent } : {}),
    ...(lwcComponent ? { lwcComponent } : {}),
    ...(flexiPage ? { flexiPage } : {}),
    ...(page ? { page } : {}),
    ...(customObject ? { customObject: customObject.toLowerCase() === 'true' } : {}),
    ...(url ? { url } : {}),
  };
}

export function parseQuickActionMetadata(xml: string, requestedName: string): QuickActionMetadata {
  const record = xml.match(/<(?:\w+:)?records(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?records>/i)?.[1];
  if (!record) throw new Error(`Salesforce did not return metadata for action ${requestedName}.`);
  const fullName = readTag(record, 'fullName') ?? requestedName;
  const label = readTag(record, 'label');
  const type = readTag(record, 'type');
  const flowDefinition = readTag(record, 'flowDefinition');
  const lightningComponent = readTag(record, 'lightningComponent');
  const visualforcePage = readTag(record, 'visualforcePage');
  return {
    fullName,
    ...(label ? { label } : {}),
    ...(type ? { type } : {}),
    ...(flowDefinition ? { flowDefinition } : {}),
    ...(lightningComponent ? { lightningComponent } : {}),
    ...(visualforcePage ? { visualforcePage } : {}),
  };
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
