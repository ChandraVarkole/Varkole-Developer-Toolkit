export type OrgEnvironment = 'production' | 'sandbox';

export interface OrgIdentity {
  key: string;
  orgId: string;
  userId: string;
  username: string;
  displayName: string;
  organizationName: string;
  instanceUrl: string;
  loginUrl: string;
  environment: OrgEnvironment;
  alias: string;
  apiVersion: string;
  connectedAt: string;
  lastUsedAt: string;
  connected: boolean;
  connectionSource: 'browser-session' | 'oauth';
}

export interface QueryRecord {
  attributes?: { type?: string; url?: string };
  [field: string]: unknown;
}

export interface QueryPage {
  totalSize: number;
  done: boolean;
  records: QueryRecord[];
  nextRecordsUrl?: string;
  apiUsage?: string;
  elapsedMs: number;
}

export interface RecordInspection {
  objectApiName: string;
  describe: SalesforceObjectDescribe;
  record: QueryRecord;
  elapsedMs: number;
  apiUsage?: string;
}

export interface MetadataFileProperty {
  fullName: string;
  type: string;
  namespacePrefix?: string;
  manageableState?: string;
  lastModifiedDate?: string;
}

export interface CustomTabMetadata {
  fullName: string;
  label?: string;
  auraComponent?: string;
  lwcComponent?: string;
  flexiPage?: string;
  page?: string;
  customObject?: boolean;
  url?: string;
}

export interface SalesforceObjectSummary {
  name: string;
  label: string;
  keyPrefix?: string;
  custom: boolean;
  queryable: boolean;
  searchable: boolean;
  createable?: boolean;
  updateable?: boolean;
  deletable?: boolean;
}

export interface SalesforcePicklistValue {
  label: string;
  value: string;
  active: boolean;
  defaultValue: boolean;
}

export interface SalesforceFieldSummary {
  name: string;
  label: string;
  type: string;
  custom: boolean;
  nillable: boolean;
  filterable: boolean;
  sortable: boolean;
  createable: boolean;
  updateable: boolean;
  length?: number;
  precision?: number;
  scale?: number;
  calculated?: boolean;
  nameField?: boolean;
  relationshipName?: string;
  referenceTo?: string[];
  restrictedPicklist?: boolean;
  picklistValues?: SalesforcePicklistValue[];
}

export interface SalesforceChildRelationship {
  childSObject: string;
  field: string;
  relationshipName?: string;
  cascadeDelete: boolean;
  restrictedDelete?: boolean;
}

export interface SalesforceObjectDescribe {
  name: string;
  label: string;
  fields: SalesforceFieldSummary[];
  childRelationships: SalesforceChildRelationship[];
  actionOverrides?: SalesforceActionOverride[];
}

export interface SalesforceActionOverride {
  name: string;
  formFactor?: string;
  pageId?: string;
  url?: string;
}

export interface SalesforceTabInfo {
  label: string;
  name?: string;
  url?: string;
  sobjectName?: string;
  custom: boolean;
}

export interface ExecuteAnonymousResult {
  compiled: boolean;
  success: boolean;
  line: number;
  column: number;
  compileProblem?: string;
  exceptionMessage?: string;
  exceptionStackTrace?: string;
}

export interface ApexTestRunSubmission {
  jobId: string;
}

export interface OrgLimit {
  Max: number;
  Remaining: number;
}

export interface OrgLicenseUsage {
  name: string;
  status: string;
  totalLicenses: number | null;
  usedLicenses: number | null;
  lastUpdated?: string;
}

export interface OrgInfo {
  id: string;
  name: string;
  organizationType: string;
  instanceName?: string;
  isSandbox: boolean;
  fiscalYearStartMonth?: number;
  apiVersion: string;
  releaseName?: string;
  latestApiVersion?: string;
  instanceUrl: string;
  username: string;
  displayName: string;
  limits: Record<string, OrgLimit>;
  apiUsage?: string;
  licenseUsage?: OrgLicenseUsage[];
}

export type ImportOperation = 'insert' | 'update' | 'delete';

export interface ImportRecordError {
  statusCode?: string;
  message: string;
  fields?: string[];
}

export interface ImportRecordResult {
  id?: string;
  success: boolean;
  created?: boolean;
  errors: ImportRecordError[];
}

export type ApiMode = 'rest' | 'tooling';

export type AiProvider = 'openai' | 'anthropic' | 'gemini' | 'bedrock';

export interface AiConnectionStatus {
  configured: boolean;
  provider?: AiProvider;
  model?: string;
  region?: string;
  dataConsentGranted?: boolean;
}

export interface AiChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface SoqlHistoryEntry {
  id: string;
  soql: string;
  mode: ApiMode;
  executedAt: string;
}

export type UiRequest =
  | { type: 'GET_STATE' }
  | { type: 'CONNECT_ORG'; payload: ConnectOrgInput }
  | { type: 'SELECT_ORG'; payload: { key: string } }
  | { type: 'DISCONNECT_ORG'; payload: { key: string } }
  | { type: 'GET_ORG_INFO'; payload: { key: string } }
  | { type: 'GET_OBJECTS'; payload: { key: string } }
  | { type: 'INSPECT_RECORD'; payload: { key: string; recordId: string } }
  | { type: 'DESCRIBE_OBJECT'; payload: { key: string; objectApiName: string } }
  | { type: 'GET_TABS'; payload: { key: string } }
  | { type: 'GET_EXTERNAL_CLIENT_APPS'; payload: { key: string; requestId: string } }
  | { type: 'GET_CUSTOM_TAB'; payload: { key: string; tabName: string } }
  | { type: 'GET_APEX_LOG_BODY'; payload: { key: string; logId: string } }
  | { type: 'GET_REPORT_RESULT'; payload: { key: string; reportId: string } }
  | { type: 'GET_DASHBOARD_RESULT'; payload: { key: string; dashboardId: string } }
  | { type: 'GET_AI_STATUS' }
  | { type: 'GET_QUERY_HISTORY'; payload: { key: string } }
  | {
      type: 'SAVE_QUERY_HISTORY';
      payload: { key: string; soql: string; mode: ApiMode };
    }
  | { type: 'DELETE_QUERY_HISTORY'; payload: { key: string; id: string } }
  | { type: 'CLEAR_QUERY_HISTORY'; payload: { key: string } }
  | {
      type: 'CONFIGURE_AI';
      payload: {
        provider: AiProvider;
        apiKey: string;
        model: string;
        region?: string;
      };
    }
  | { type: 'GRANT_AI_DATA_CONSENT' }
  | { type: 'DISCONNECT_AI' }
  | {
      type: 'ASK_AI';
      payload: {
        messages: AiChatMessage[];
        salesforceContext: string;
        maxOutputTokens?: number;
      };
    }
  | {
      type: 'RUN_APEX';
      payload: {
        key: string;
        apex: string;
        requestId: string;
        confirmedProduction: boolean;
      };
    }
  | {
      type: 'RUN_ALL_APEX_TESTS';
      payload: {
        key: string;
        requestId: string;
        confirmedProduction: boolean;
      };
    }
  | {
      type: 'IMPORT_RECORDS';
      payload: {
        key: string;
        objectApiName: string;
        operation: ImportOperation;
        records: Record<string, unknown>[];
        requestId: string;
        confirmedIrreversible: boolean;
        confirmedProduction: boolean;
      };
    }
  | {
      type: 'RUN_QUERY';
      payload: { key: string; soql: string; mode: ApiMode; requestId: string };
    }
  | {
      type: 'QUERY_NEXT';
      payload: { key: string; nextRecordsUrl: string; requestId: string; mode?: ApiMode };
    }
  | { type: 'CANCEL_REQUEST'; payload: { requestId: string } };

export interface ConnectOrgInput {
  environment: 'production' | 'sandbox' | 'custom';
  customDomain?: string;
  alias?: string;
}

export interface ExtensionState {
  orgs: OrgIdentity[];
  selectedOrgKey?: string;
  configured: boolean;
  redirectUrl: string;
}

export type UiResponse<T = unknown> = { ok: true; data: T } | { ok: false; error: AppErrorData };

export type AppErrorCode =
  | 'AUTH_CANCELLED'
  | 'AUTH_CONFIG'
  | 'AUTH_EXPIRED'
  | 'INVALID_HOST'
  | 'INVALID_REQUEST'
  | 'NETWORK'
  | 'OFFLINE'
  | 'PERMISSION_DENIED'
  | 'RATE_LIMITED'
  | 'SALESFORCE'
  | 'UNKNOWN';

export interface AppErrorData {
  code: AppErrorCode;
  message: string;
  detail?: string;
  status?: number;
  retryable: boolean;
}

export class AppError extends Error {
  readonly data: AppErrorData;

  constructor(data: AppErrorData) {
    super(data.message);
    this.name = 'AppError';
    this.data = data;
  }
}

export function toAppErrorData(error: unknown): AppErrorData {
  if (error instanceof AppError) return error.data;
  if (error instanceof DOMException && error.name === 'AbortError') {
    return { code: 'NETWORK', message: 'The request was cancelled.', retryable: true };
  }
  if (error instanceof TypeError) {
    const online = typeof navigator === 'undefined' || navigator.onLine;
    return {
      code: online ? 'NETWORK' : 'OFFLINE',
      message: online
        ? 'Salesforce could not be reached. Check your network and org domain.'
        : 'You appear to be offline.',
      detail: error.message,
      retryable: true,
    };
  }
  return {
    code: 'UNKNOWN',
    message: error instanceof Error ? error.message : 'An unexpected error occurred.',
    retryable: false,
  };
}
