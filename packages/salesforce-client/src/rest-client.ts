import type {
  ImportOperation,
  ImportRecordResult,
  OrgLicenseUsage,
  OrgInfo,
  OrgLimit,
  QueryPage,
  QueryRecord,
  RecordInspection,
  SalesforceActionOverride,
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
  TimeZoneSidKey?: string;
}

interface UserLicenseRecord extends QueryRecord {
  Name?: string;
  MasterLabel?: string;
  Status?: string;
  TotalLicenses?: number | null;
  UsedLicenses?: number | null;
  UsedLicensesLastUpdated?: string;
}

interface RawDescribeResponse {
  name: string;
  label: string;
  fields: SalesforceFieldSummary[];
  childRelationships?: SalesforceChildRelationship[];
  actionOverrides?: SalesforceActionOverride[];
}

interface RawObjectSummary extends SalesforceObjectSummary {
  createable?: boolean;
  updateable?: boolean;
  deletable?: boolean;
}

interface RawUiRecord {
  apiName?: unknown;
}

interface RawTabInfo {
  label?: string;
  name?: string;
  url?: string;
  sobjectName?: string;
  custom?: boolean;
}

interface RawApiVersion {
  label: string;
  url: string;
  version: string;
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

  async resolveRecordObjectApiName(recordId: string, signal?: AbortSignal): Promise<string> {
    if (!/^[A-Za-z0-9]{15}(?:[A-Za-z0-9]{3})?$/.test(recordId) || recordId.startsWith('00D')) {
      throw new Error('Enter a valid Salesforce record ID.');
    }
    const result = await this.transport.get<RawUiRecord>(
      `${this.apiRoot}/ui-api/records/${encodeURIComponent(recordId)}?layoutTypes=Compact&modes=View`,
      signal,
    );
    if (
      typeof result.data.apiName !== 'string' ||
      !/^[A-Za-z][A-Za-z0-9_]*$/.test(result.data.apiName)
    ) {
      throw new Error('Salesforce did not return the object API name for this record.');
    }
    return result.data.apiName;
  }

  async inspectRecord(recordId: string, signal?: AbortSignal): Promise<RecordInspection> {
    const started = performance.now();
    let objectApiName: string;
    try {
      objectApiName = await this.resolveRecordObjectApiName(recordId, signal);
    } catch (resolutionError) {
      const prefix = recordId.slice(0, 3).toLowerCase();
      const matchingObject = (await this.listObjects(signal)).find(
        (object) => object.keyPrefix?.toLowerCase() === prefix,
      );
      if (!matchingObject) throw resolutionError;
      objectApiName = matchingObject.name;
    }
    const describe = await this.describeObject(objectApiName, signal);
    let recordResult: { data: QueryRecord; apiUsage?: string };
    try {
      recordResult = await this.transport.get<QueryRecord>(
        `${this.apiRoot}/sobjects/${encodeURIComponent(objectApiName)}/${encodeURIComponent(recordId)}`,
        signal,
      );
      const returnedFields = Object.keys(recordResult.data).filter((key) => key !== 'attributes');
      if (returnedFields.length <= 1) {
        const fallback = await this.query(
          `SELECT FIELDS(ALL) FROM ${objectApiName} WHERE Id = '${recordId}' LIMIT 1`,
          signal,
        );
        const record = fallback.records[0];
        if (record)
          recordResult = {
            data: record,
            ...(fallback.apiUsage ? { apiUsage: fallback.apiUsage } : {}),
          };
      }
    } catch (recordError) {
      const fallback = await this.query(
        `SELECT FIELDS(ALL) FROM ${objectApiName} WHERE Id = '${recordId}' LIMIT 1`,
        signal,
      );
      const record = fallback.records[0];
      if (!record) throw recordError;
      recordResult = {
        data: record,
        ...(fallback.apiUsage ? { apiUsage: fallback.apiUsage } : {}),
      };
    }
    return {
      objectApiName,
      describe,
      record: recordResult.data,
      elapsedMs: Math.round(performance.now() - started),
      ...(recordResult.apiUsage ? { apiUsage: recordResult.apiUsage } : {}),
    };
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
      ...(result.data.actionOverrides?.length
        ? {
            actionOverrides: result.data.actionOverrides.filter(
              (override) => typeof override.name === 'string',
            ),
          }
        : {}),
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

  async importRecords(
    objectApiName: string,
    operation: ImportOperation,
    records: Record<string, unknown>[],
    signal?: AbortSignal,
  ): Promise<ImportRecordResult[]> {
    validateImportRequest(objectApiName, operation, records);
    const endpoint = `${this.apiRoot}/composite/sobjects`;
    if (operation === 'delete') {
      const ids = records.map((record) => String(record.Id));
      const result = await this.transport.writeJson<ImportRecordResult[]>(
        'DELETE',
        `${endpoint}?ids=${ids.map(encodeURIComponent).join(',')}&allOrNone=false`,
        undefined,
        signal,
      );
      return result.data;
    }
    const payload = {
      allOrNone: false,
      records: records.map((record) => ({ attributes: { type: objectApiName }, ...record })),
    };
    const result = await this.transport.writeJson<ImportRecordResult[]>(
      operation === 'insert' ? 'POST' : 'PATCH',
      endpoint,
      payload,
      signal,
    );
    return result.data;
  }

  async getReportResult(reportId: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
    if (!/^00O[A-Za-z0-9]{12}(?:[A-Za-z0-9]{3})?$/.test(reportId)) {
      throw new Error('Enter a valid Salesforce report ID.');
    }
    const result = await this.transport.get<Record<string, unknown>>(
      `${this.apiRoot}/analytics/reports/${encodeURIComponent(reportId)}?includeDetails=true`,
      signal,
    );
    return result.data;
  }

  async getDashboardResult(
    dashboardId: string,
    signal?: AbortSignal,
  ): Promise<Record<string, unknown>> {
    if (!/^01Z[A-Za-z0-9]{12}(?:[A-Za-z0-9]{3})?$/.test(dashboardId)) {
      throw new Error('Enter a valid Salesforce dashboard ID.');
    }
    const result = await this.transport.get<Record<string, unknown>>(
      `${this.apiRoot}/analytics/dashboards/${encodeURIComponent(dashboardId)}`,
      signal,
    );
    return result.data;
  }

  async orgInfo(
    identity: { username: string; displayName: string; instanceUrl: string },
    apiVersion: string,
    signal?: AbortSignal,
  ): Promise<OrgInfo> {
    const unavailableLimits: { limits: Record<string, OrgLimit>; apiUsage?: string } = {
      limits: {},
    };
    const [orgPage, limitResult, versions, licensePage] = await Promise.all([
      this.query(
        'SELECT Id, Name, OrganizationType, InstanceName, IsSandbox, FiscalYearStartMonth, TimeZoneSidKey FROM Organization LIMIT 1',
        signal,
      ),
      this.limits(signal).catch(() => unavailableLimits),
      this.transport
        .get<RawApiVersion[]>('/services/data/', signal)
        .then((result) => result.data)
        .catch(() => []),
      this.query(
        'SELECT Name, MasterLabel, Status, TotalLicenses, UsedLicenses, UsedLicensesLastUpdated FROM UserLicense ORDER BY MasterLabel ASC',
        signal,
      ).catch(() => undefined),
    ]);
    const org = orgPage.records[0] as OrganizationRecord | undefined;
    if (!org) throw new Error('Salesforce did not return an Organization record.');
    const latestVersion = [...versions].sort(
      (left, right) => Number(right.version) - Number(left.version),
    )[0];
    return {
      id: org.Id,
      name: org.Name,
      organizationType: org.OrganizationType,
      ...(org.TimeZoneSidKey ? { timeZone: org.TimeZoneSidKey } : {}),
      ...(org.InstanceName ? { instanceName: org.InstanceName } : {}),
      isSandbox: org.IsSandbox,
      ...(org.FiscalYearStartMonth ? { fiscalYearStartMonth: org.FiscalYearStartMonth } : {}),
      apiVersion,
      ...(latestVersion?.label ? { releaseName: latestVersion.label } : {}),
      ...(latestVersion?.version ? { latestApiVersion: latestVersion.version } : {}),
      instanceUrl: identity.instanceUrl,
      username: identity.username,
      displayName: identity.displayName,
      limits: limitResult.limits,
      ...(limitResult.apiUsage ? { apiUsage: limitResult.apiUsage } : {}),
      ...(licensePage ? { licenseUsage: formatLicenseUsage(licensePage.records) } : {}),
    };
  }
}

function formatLicenseUsage(records: QueryRecord[]): OrgLicenseUsage[] {
  return records
    .map((record) => record as UserLicenseRecord)
    .map((record) => ({
      name: record.MasterLabel?.trim() || record.Name?.trim() || 'Unnamed license',
      status: record.Status?.trim() || 'Unknown',
      totalLicenses: finiteNumberOrNull(record.TotalLicenses),
      usedLicenses: finiteNumberOrNull(record.UsedLicenses),
      ...(record.UsedLicensesLastUpdated ? { lastUpdated: record.UsedLicensesLastUpdated } : {}),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function finiteNumberOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function validateImportRequest(
  objectApiName: string,
  operation: ImportOperation,
  records: Record<string, unknown>[],
): void {
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(objectApiName)) {
    throw new Error('Enter a valid Salesforce object API name.');
  }
  if (!['insert', 'update', 'delete'].includes(operation)) {
    throw new Error('Choose a supported import operation.');
  }
  if (records.length < 1 || records.length > 200) {
    throw new Error('Each Salesforce import batch must contain 1 through 200 records.');
  }
  for (const record of records) {
    const fields = Object.keys(record);
    if (fields.some((field) => field === 'attributes' || !/^[A-Za-z][A-Za-z0-9_]*$/.test(field))) {
      throw new Error('Import data contains an invalid Salesforce field name.');
    }
    const id = record.Id;
    if (
      operation !== 'insert' &&
      (typeof id !== 'string' || !/^[A-Za-z0-9]{15}(?:[A-Za-z0-9]{3})?$/.test(id))
    ) {
      throw new Error(
        `${operation === 'delete' ? 'Delete' : 'Update'} rows require a valid Salesforce Id.`,
      );
    }
    if (operation === 'insert' && fields.includes('Id')) {
      throw new Error('Create rows cannot include Salesforce record IDs.');
    }
  }
}
