import type {
  OrgInfo,
  OrgLimit,
  QueryPage,
  QueryRecord,
  SalesforceChildRelationship,
  SalesforceFieldSummary,
  SalesforceObjectDescribe,
  SalesforceObjectSummary,
  SalesforceTabInfo,
} from '@varkole/shared';
import type { SalesforceTransport } from './transport';

interface RawQueryResponse {
  totalSize: number;
  done: boolean;
  records: QueryRecord[];
  nextRecordsUrl?: string;
}

interface OrganizationRecord extends QueryRecord {
  Id: string;
  Name: string;
  OrganizationType: string;
  InstanceName?: string;
  IsSandbox: boolean;
  FiscalYearStartMonth?: number;
}

interface RawDescribeResponse {
  name: string;
  label: string;
  fields: SalesforceFieldSummary[];
  childRelationships?: SalesforceChildRelationship[];
}

interface RawObjectSummary extends SalesforceObjectSummary {
  createable?: boolean;
  updateable?: boolean;
  deletable?: boolean;
}

interface RawTabInfo {
  label?: string;
  name?: string;
  url?: string;
  sobjectName?: string;
  custom?: boolean;
}

export interface RestClientOptions {
  transport: SalesforceTransport;
  apiVersion: string;
}

export class SalesforceRestClient {
  private readonly transport: SalesforceTransport;
  private readonly apiRoot: string;

  constructor(options: RestClientOptions) {
    this.transport = options.transport;
    this.apiRoot = `/services/data/v${options.apiVersion}`;
  }

  async query(soql: string, signal?: AbortSignal): Promise<QueryPage> {
    if (!soql.trim()) throw new Error('SOQL query cannot be empty.');
    const started = performance.now();
    const result = await this.transport.get<RawQueryResponse>(
      `${this.apiRoot}/query?q=${encodeURIComponent(soql)}`,
      signal,
    );
    return {
      ...result.data,
      ...(result.apiUsage ? { apiUsage: result.apiUsage } : {}),
      elapsedMs: Math.round(performance.now() - started),
    };
  }

  async queryNext(nextRecordsUrl: string, signal?: AbortSignal): Promise<QueryPage> {
    const started = performance.now();
    const result = await this.transport.get<RawQueryResponse>(nextRecordsUrl, signal);
    return {
      ...result.data,
      ...(result.apiUsage ? { apiUsage: result.apiUsage } : {}),
      elapsedMs: Math.round(performance.now() - started),
    };
  }

  async limits(signal?: AbortSignal): Promise<{
    limits: Record<string, OrgLimit>;
    apiUsage?: string;
  }> {
    const result = await this.transport.get<Record<string, OrgLimit>>(
      `${this.apiRoot}/limits`,
      signal,
    );
    return {
      limits: result.data,
      ...(result.apiUsage ? { apiUsage: result.apiUsage } : {}),
    };
  }

  async listObjects(signal?: AbortSignal): Promise<SalesforceObjectSummary[]> {
    const result = await this.transport.get<{ sobjects: RawObjectSummary[] }>(
      `${this.apiRoot}/sobjects`,
      signal,
    );
    return result.data.sobjects
      .filter((object) => object.queryable)
      .map((object) => {
        const label =
          typeof object.label === 'string' && !/^missing label$/i.test(object.label.trim())
            ? object.label.trim()
            : object.name;
        return {
          name: object.name,
          label,
          ...(object.keyPrefix ? { keyPrefix: object.keyPrefix } : {}),
          custom: object.custom,
          queryable: object.queryable,
          searchable: object.searchable,
          createable: Boolean(object.createable),
          updateable: Boolean(object.updateable),
          deletable: Boolean(object.deletable),
        };
      })
      .sort((left, right) =>
        left.label.localeCompare(right.label, undefined, { sensitivity: 'base', numeric: true }),
      );
  }

  async describeObject(
    objectApiName: string,
    signal?: AbortSignal,
  ): Promise<SalesforceObjectDescribe> {
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(objectApiName)) {
      throw new Error('Enter a valid Salesforce object API name.');
    }
    const result = await this.transport.get<RawDescribeResponse>(
      `${this.apiRoot}/sobjects/${encodeURIComponent(objectApiName)}/describe`,
      signal,
    );
    return {
      name: result.data.name,
      label: result.data.label,
      fields: result.data.fields.map((field) => ({
        name: field.name,
        label: field.label,
        type: field.type,
        custom: field.custom,
        nillable: field.nillable,
        filterable: field.filterable,
        sortable: field.sortable,
        createable: field.createable,
        updateable: field.updateable,
        ...(typeof field.length === 'number' ? { length: field.length } : {}),
        ...(typeof field.precision === 'number' ? { precision: field.precision } : {}),
        ...(typeof field.scale === 'number' ? { scale: field.scale } : {}),
        ...(typeof field.calculated === 'boolean' ? { calculated: field.calculated } : {}),
        ...(typeof field.nameField === 'boolean' ? { nameField: field.nameField } : {}),
        ...(field.relationshipName ? { relationshipName: field.relationshipName } : {}),
        ...(field.referenceTo?.length ? { referenceTo: field.referenceTo } : {}),
        ...(typeof field.restrictedPicklist === 'boolean'
          ? { restrictedPicklist: field.restrictedPicklist }
          : {}),
        ...(field.picklistValues?.length ? { picklistValues: field.picklistValues } : {}),
      })),
      childRelationships: (result.data.childRelationships ?? [])
        .filter(
          (relationship) =>
            relationship.childSObject &&
            relationship.field &&
            !relationship.childSObject.endsWith('ChangeEvent'),
        )
        .map((relationship) => ({
          childSObject: relationship.childSObject,
          field: relationship.field,
          ...(relationship.relationshipName
            ? { relationshipName: relationship.relationshipName }
            : {}),
          cascadeDelete: Boolean(relationship.cascadeDelete),
          ...(typeof relationship.restrictedDelete === 'boolean'
            ? { restrictedDelete: relationship.restrictedDelete }
            : {}),
        })),
    };
  }

  async getTabs(signal?: AbortSignal): Promise<SalesforceTabInfo[]> {
    const result = await this.transport.get<RawTabInfo[]>(`${this.apiRoot}/tabs`, signal);
    return result.data.map((tab) => ({
      label: tab.label ?? tab.name ?? tab.sobjectName ?? 'Unnamed tab',
      ...(tab.name ? { name: tab.name } : {}),
      ...(tab.url ? { url: tab.url } : {}),
      ...(tab.sobjectName ? { sobjectName: tab.sobjectName } : {}),
      custom: Boolean(tab.custom),
    }));
  }

  async orgInfo(
    identity: { username: string; displayName: string; instanceUrl: string },
    apiVersion: string,
    signal?: AbortSignal,
  ): Promise<OrgInfo> {
    const unavailableLimits: { limits: Record<string, OrgLimit>; apiUsage?: string } = {
      limits: {},
    };
    const [orgPage, limitResult] = await Promise.all([
      this.query(
        'SELECT Id, Name, OrganizationType, InstanceName, IsSandbox, FiscalYearStartMonth FROM Organization LIMIT 1',
        signal,
      ),
      this.limits(signal).catch(() => unavailableLimits),
    ]);
    const org = orgPage.records[0] as OrganizationRecord | undefined;
    if (!org) throw new Error('Salesforce did not return an Organization record.');
    return {
      id: org.Id,
      name: org.Name,
      organizationType: org.OrganizationType,
      ...(org.InstanceName ? { instanceName: org.InstanceName } : {}),
      isSandbox: org.IsSandbox,
      ...(org.FiscalYearStartMonth ? { fiscalYearStartMonth: org.FiscalYearStartMonth } : {}),
      apiVersion,
      instanceUrl: identity.instanceUrl,
      username: identity.username,
      displayName: identity.displayName,
      limits: limitResult.limits,
      ...(limitResult.apiUsage ? { apiUsage: limitResult.apiUsage } : {}),
    };
  }
}
