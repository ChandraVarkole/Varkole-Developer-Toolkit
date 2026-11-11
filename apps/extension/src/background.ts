import {
  SalesforceMetadataClient,
  SalesforceRestClient,
  SalesforceToolingClient,
  SalesforceTransport,
  createPkcePair,
  normalizeSalesforceLoginUrl,
  validateOAuthCallback,
  validateSalesforceUrl,
} from '@varkole/salesforce-client';
import {
  AppError,
  toAppErrorData,
  type AiConnectionStatus,
  type AiProvider,
  type ConnectOrgInput,
  type ExtensionState,
  type OrgIdentity,
  type SoqlHistoryEntry,
  type UiRequest,
  type UiResponse,
} from '@varkole/shared';
import { requestAiResponse, validateAiConfig, type AiSessionConfig } from './ai-provider';
import { createAiDataConsent, isAiDataConsentActive, type AiDataConsent } from './ai-consent';
import { addQueryHistoryEntry } from './query-history';
import {
  cookieMatchesOrg,
  normalizeSalesforceApiHost,
  selectApiSessionCookie,
} from './session-cookie';
import { isTrustedExtensionPageSender } from './message-security';

const CLIENT_ID = import.meta.env.VITE_SALESFORCE_CLIENT_ID?.trim() ?? '';
const API_VERSION = import.meta.env.VITE_SALESFORCE_API_VERSION?.trim() || '68.0';
const ORGS_KEY = 'org-metadata-v1';
const SELECTED_ORG_KEY = 'selected-org-v1';
const TOKEN_PREFIX = 'org-token-v1:';
const AI_CONFIG_KEY = 'ai-provider-session-v1';
const AI_DATA_CONSENT_KEY = 'ai-data-consent-v1';
const AI_KEY_TTL_MS = 8 * 60 * 60 * 1_000;
const LEGACY_AI_REMEMBERED_CONFIG_KEY = 'ai-provider-remembered-v1';
const QUERY_HISTORY_PREFIX = 'soql-history-v1:';

interface OrgTokenSession {
  accessToken: string;
  refreshToken?: string;
  loginUrl: string;
  instanceUrl: string;
  issuedAt: string;
  source: 'browser-session' | 'oauth';
  cookieDomain?: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  instance_url: string;
  id: string;
  issued_at?: string;
}

interface RefreshTokenResponse {
  access_token: string;
  refresh_token?: string;
  instance_url?: string;
  issued_at?: string;
}

interface SalesforceIdentity {
  organization_id: string;
  user_id: string;
  username?: string;
  display_name?: string;
  preferred_username?: string;
  name?: string;
}

const activeRequests = new Map<string, AbortController>();

chrome.runtime.onInstalled.addListener(() => {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
});

void Promise.all([
  chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }),
  chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }),
  chrome.storage.local.remove(LEGACY_AI_REMEMBERED_CONFIG_KEY),
]);

chrome.action.onClicked.addListener((tab) => {
  if (!tab.id) return;
  void chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_VARKOLE_PANEL' }).catch(() => undefined);
});

chrome.runtime.onMessage.addListener(
  (request: UiRequest, sender, sendResponse: (response: UiResponse) => void) => {
    if (!isTrustedExtensionPageSender(chrome.runtime.id, sender.id, sender.url)) {
      sendResponse({
        ok: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Messages are accepted only from this extension.',
          retryable: false,
        },
      });
      return false;
    }
    void handleRequest(request)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error: unknown) => sendResponse({ ok: false, error: toAppErrorData(error) }));
    return true;
  },
);

async function handleRequest(request: UiRequest): Promise<unknown> {
  switch (request.type) {
    case 'GET_STATE':
      await discoverActiveSalesforceSession();
      return getState();
    case 'CONNECT_ORG':
      return connectOrg(request.payload);
    case 'SELECT_ORG':
      await ensureKnownOrg(request.payload.key);
      await chrome.storage.local.set({ [SELECTED_ORG_KEY]: request.payload.key });
      return getState();
    case 'DISCONNECT_ORG':
      return disconnectOrg(request.payload.key);
    case 'GET_ORG_INFO':
      return withRestClient(request.payload.key, (client, org, signal) =>
        client.orgInfo(org, org.apiVersion, signal),
      );
    case 'GET_OBJECTS':
      return withRestClient(request.payload.key, (client, _org, signal) =>
        client.listObjects(signal),
      );
    case 'DESCRIBE_OBJECT':
      return withRestClient(request.payload.key, (client, _org, signal) =>
        client.describeObject(request.payload.objectApiName, signal),
      );
    case 'GET_TABS':
      return withRestClient(request.payload.key, (client, _org, signal) => client.getTabs(signal));
    case 'GET_EXTERNAL_CLIENT_APPS':
      return runAbortable(request.payload.requestId, (signal) =>
        withMetadataClient(request.payload.key, (client) =>
          client.listExternalClientApplications(signal),
        ),
      );
    case 'GET_APEX_LOG_BODY':
      return withToolingClient(request.payload.key, (client) =>
        client.getApexLogBody(request.payload.logId),
      );
    case 'GET_REPORT_RESULT':
      return withRestClient(request.payload.key, (client, _org, signal) =>
        client.getReportResult(request.payload.reportId, signal),
      );
    case 'GET_DASHBOARD_RESULT':
      return withRestClient(request.payload.key, (client, _org, signal) =>
        client.getDashboardResult(request.payload.dashboardId, signal),
      );
    case 'GET_AI_STATUS':
      return getAiStatus();
    case 'GET_QUERY_HISTORY':
      return getQueryHistory(request.payload.key);
    case 'SAVE_QUERY_HISTORY':
      return saveQueryHistory(request.payload.key, request.payload.soql, request.payload.mode);
    case 'DELETE_QUERY_HISTORY':
      return deleteQueryHistory(request.payload.key, request.payload.id);
    case 'CLEAR_QUERY_HISTORY':
      return clearQueryHistory(request.payload.key);
    case 'CONFIGURE_AI':
      return configureAi(request.payload);
    case 'GRANT_AI_DATA_CONSENT':
      return grantAiDataConsent();
    case 'DISCONNECT_AI':
      await Promise.all([
        chrome.storage.session.remove([AI_CONFIG_KEY, AI_DATA_CONSENT_KEY]),
        chrome.storage.local.remove(LEGACY_AI_REMEMBERED_CONFIG_KEY),
      ]);
      return getAiStatus();
    case 'ASK_AI': {
      const config = await requireAiConfig();
      await requireAiDataConsent(config.provider);
      return requestAiResponse(
        config,
        request.payload.messages,
        request.payload.salesforceContext,
        request.payload.maxOutputTokens,
      );
    }
    case 'RUN_QUERY':
      return runAbortable(request.payload.requestId, (signal) =>
        request.payload.mode === 'tooling'
          ? withToolingClient(request.payload.key, (client) =>
              client.query(request.payload.soql, signal),
            )
          : withRestClient(request.payload.key, (client) =>
              client.query(request.payload.soql, signal),
            ),
      );
    case 'RUN_APEX': {
      const org = await ensureKnownOrg(request.payload.key);
      if (org.environment === 'production' && !request.payload.confirmedProduction) {
        throw new AppError({
          code: 'INVALID_REQUEST',
          message: 'Production Apex requires the explicit production confirmation.',
          retryable: false,
        });
      }
      return runAbortable(request.payload.requestId, (signal) =>
        withToolingClient(request.payload.key, (client) =>
          client.executeAnonymous(request.payload.apex, signal),
        ),
      );
    }
    case 'RUN_ALL_APEX_TESTS': {
      const org = await ensureKnownOrg(request.payload.key);
      if (org.environment === 'production' && !request.payload.confirmedProduction) {
        throw new AppError({
          code: 'INVALID_REQUEST',
          message: 'Production test execution requires the explicit production confirmation.',
          retryable: false,
        });
      }
      return runAbortable(request.payload.requestId, (signal) =>
        withToolingClient(request.payload.key, (client) => client.runAllApexTests(signal)),
      );
    }
    case 'IMPORT_RECORDS': {
      const org = await ensureKnownOrg(request.payload.key);
      if (!request.payload.confirmedIrreversible) {
        throw new AppError({
          code: 'INVALID_REQUEST',
          message:
            'Import requires explicit confirmation that successful changes cannot be reverted.',
          retryable: false,
        });
      }
      if (org.environment === 'production' && !request.payload.confirmedProduction) {
        throw new AppError({
          code: 'INVALID_REQUEST',
          message: 'Production import requires the explicit production confirmation.',
          retryable: false,
        });
      }
      return runAbortable(request.payload.requestId, (signal) =>
        withRestClient(
          request.payload.key,
          (client) =>
            client.importRecords(
              request.payload.objectApiName,
              request.payload.operation,
              request.payload.records,
              signal,
            ),
          signal,
        ),
      );
    }
    case 'QUERY_NEXT':
      return runAbortable(request.payload.requestId, (signal) =>
        request.payload.mode === 'tooling'
          ? withToolingClient(request.payload.key, (client) =>
              client.queryNext(request.payload.nextRecordsUrl, signal),
            )
          : withRestClient(request.payload.key, (client) =>
              client.queryNext(request.payload.nextRecordsUrl, signal),
            ),
      );
    case 'CANCEL_REQUEST':
      activeRequests.get(request.payload.requestId)?.abort();
      return undefined;
  }
}

async function getState(): Promise<ExtensionState> {
  const stored = await chrome.storage.local.get([ORGS_KEY, SELECTED_ORG_KEY]);
  const orgs = (stored[ORGS_KEY] as OrgIdentity[] | undefined) ?? [];
  const sessions = await chrome.storage.session.get(orgs.map((org) => tokenKey(org.key)));
  const resolvedOrgs = await Promise.all(
    orgs.map(async (org) => {
      const connectionSource = org.connectionSource ?? 'oauth';
      let connected = Boolean(sessions[tokenKey(org.key)]);
      if (!connected && connectionSource === 'browser-session') {
        connected = Boolean(await recoverBrowserSession(org));
      }
      return { ...org, connected, connectionSource };
    }),
  );
  return {
    orgs: resolvedOrgs,
    ...(typeof stored[SELECTED_ORG_KEY] === 'string'
      ? { selectedOrgKey: stored[SELECTED_ORG_KEY] }
      : {}),
    configured: CLIENT_ID.length > 0,
    redirectUrl: chrome.identity.getRedirectURL('salesforce'),
  };
}

async function discoverActiveSalesforceSession(): Promise<void> {
  let tabs: chrome.tabs.Tab[];
  try {
    tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  } catch {
    return;
  }
  const activeUrl = tabs[0]?.url;
  if (!activeUrl) return;

  let pageUrl: URL;
  try {
    pageUrl = validateSalesforceUrl(activeUrl);
  } catch {
    return;
  }

  const pageCookie = await chrome.cookies.get({ url: pageUrl.origin, name: 'sid' });
  if (!pageCookie) return;
  const [orgId] = pageCookie.value.split('!');
  if (!orgId || !/^00D[a-zA-Z0-9]{12,15}$/.test(orgId)) return;

  const sessionCookie = await findLiveBrowserSessionCookie(orgId, pageUrl.origin);
  if (!sessionCookie) return;
  const cookieDomain = sessionCookie.domain.replace(/^\./, '');
  let instanceUrl: string;
  try {
    instanceUrl = validateSalesforceUrl(`https://${cookieDomain}`).origin;
  } catch {
    return;
  }

  let identity: SalesforceIdentity;
  try {
    identity = await fetchUserInfo(instanceUrl, sessionCookie.value);
  } catch {
    return;
  }
  const userId = identity.user_id;
  if (!userId) return;
  const orgKey = `${identity.organization_id || orgId}:${userId}`;
  const username = identity.username ?? identity.preferred_username ?? 'Current Salesforce user';
  const displayName = identity.display_name ?? identity.name ?? username;
  const session: OrgTokenSession = {
    accessToken: '',
    loginUrl: pageUrl.origin,
    instanceUrl,
    issuedAt: new Date().toISOString(),
    source: 'browser-session',
    cookieDomain,
  };

  const orgProbe: OrgIdentity = {
    key: orgKey,
    orgId: identity.organization_id || orgId,
    userId,
    username,
    displayName,
    organizationName: identity.organization_id || orgId,
    instanceUrl,
    loginUrl: pageUrl.origin,
    environment: isLikelySandbox(pageUrl.hostname, cookieDomain) ? 'sandbox' : 'production',
    alias: '',
    apiVersion: API_VERSION,
    connectedAt: new Date().toISOString(),
    lastUsedAt: new Date().toISOString(),
    connected: true,
    connectionSource: 'browser-session',
  };
  try {
    const transport = new SalesforceTransport({
      instanceUrl,
      accessToken: sessionCookie.value,
    });
    const client = new SalesforceRestClient({ transport, apiVersion: API_VERSION });
    const info = await client.orgInfo(orgProbe, API_VERSION);
    orgProbe.organizationName = info.name;
    orgProbe.environment = info.isSandbox ? 'sandbox' : 'production';
  } catch {
    // Keep the discovered identity. Module calls will show an API Access Control error if needed.
  }

  const stored = await chrome.storage.local.get([ORGS_KEY, SELECTED_ORG_KEY]);
  const orgs = (stored[ORGS_KEY] as OrgIdentity[] | undefined) ?? [];
  const existing = orgs.find((org) => org.key === orgKey);
  if (existing?.alias) orgProbe.alias = existing.alias;
  if (existing?.connectedAt) orgProbe.connectedAt = existing.connectedAt;
  await chrome.storage.session.set({ [tokenKey(orgKey)]: session });
  await chrome.storage.local.set({
    [ORGS_KEY]: [orgProbe, ...orgs.filter((org) => org.key !== orgKey)],
    [SELECTED_ORG_KEY]: orgKey,
  });
}

function isLikelySandbox(...hosts: string[]): boolean {
  return hosts.some((host) => host.includes('.sandbox.') || host.includes('--'));
}

async function connectOrg(input: ConnectOrgInput): Promise<ExtensionState> {
  if (!CLIENT_ID) {
    throw new AppError({
      code: 'AUTH_CONFIG',
      message: 'Add VITE_SALESFORCE_CLIENT_ID to .env and rebuild the extension.',
      retryable: false,
    });
  }
  const loginUrl = resolveLoginUrl(input);
  const redirectUrl = chrome.identity.getRedirectURL('salesforce');
  const { verifier, challenge } = await createPkcePair();
  const state = crypto.randomUUID();
  const authorize = new URL('/services/oauth2/authorize', loginUrl);
  authorize.search = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: redirectUrl,
    scope: 'api refresh_token openid',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
  }).toString();

  let callback: string | undefined;
  try {
    callback = await chrome.identity.launchWebAuthFlow({ url: authorize.href, interactive: true });
  } catch (error) {
    throw new AppError({
      code: 'AUTH_CANCELLED',
      message: 'Salesforce connection was closed before it completed.',
      ...(error instanceof Error ? { detail: error.message } : {}),
      retryable: true,
    });
  }
  if (!callback) {
    throw new AppError({
      code: 'AUTH_CANCELLED',
      message: 'Salesforce connection was cancelled.',
      retryable: true,
    });
  }
  const { code } = validateOAuthCallback(callback, redirectUrl, state);
  const tokens = await exchangeCode(loginUrl, redirectUrl, code, verifier);
  const identity = await fetchIdentity(tokens.id, tokens.access_token);
  const orgKey = `${identity.organization_id}:${identity.user_id}`;
  const session: OrgTokenSession = {
    accessToken: tokens.access_token,
    ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
    loginUrl,
    instanceUrl: validateSalesforceUrl(tokens.instance_url).origin,
    issuedAt: tokens.issued_at ?? new Date().toISOString(),
    source: 'oauth',
  };
  await chrome.storage.session.set({ [tokenKey(orgKey)]: session });

  const orgProbe: OrgIdentity = {
    key: orgKey,
    orgId: identity.organization_id,
    userId: identity.user_id,
    username: identity.username ?? identity.preferred_username ?? 'Current Salesforce user',
    displayName:
      identity.display_name ?? identity.name ?? identity.username ?? 'Current Salesforce user',
    organizationName: input.alias?.trim() || identity.organization_id,
    instanceUrl: session.instanceUrl,
    loginUrl,
    environment: input.environment === 'production' ? 'production' : 'sandbox',
    alias: input.alias?.trim() || '',
    apiVersion: API_VERSION,
    connectedAt: new Date().toISOString(),
    lastUsedAt: new Date().toISOString(),
    connected: true,
    connectionSource: 'oauth',
  };
  try {
    const transport = new SalesforceTransport({
      instanceUrl: session.instanceUrl,
      accessToken: session.accessToken,
    });
    const client = new SalesforceRestClient({ transport, apiVersion: API_VERSION });
    const info = await client.orgInfo(orgProbe, API_VERSION);
    orgProbe.organizationName = info.name;
    orgProbe.environment = info.isSandbox ? 'sandbox' : 'production';
  } catch {
    // Identity data is sufficient to retain the connection; Org Info will expose the exact error.
  }

  const stored = await chrome.storage.local.get(ORGS_KEY);
  const orgs = (stored[ORGS_KEY] as OrgIdentity[] | undefined) ?? [];
  const next = [orgProbe, ...orgs.filter((org) => org.key !== orgKey)];
  await chrome.storage.local.set({ [ORGS_KEY]: next, [SELECTED_ORG_KEY]: orgKey });
  return getState();
}

async function exchangeCode(
  loginUrl: string,
  redirectUrl: string,
  code: string,
  verifier: string,
): Promise<TokenResponse> {
  const response = await fetch(`${loginUrl}/services/oauth2/token`, {
    method: 'POST',
    credentials: 'omit',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      redirect_uri: redirectUrl,
      code,
      code_verifier: verifier,
    }),
  });
  if (!response.ok) throw await oauthResponseError(response);
  return (await response.json()) as TokenResponse;
}

async function fetchIdentity(url: string, accessToken: string): Promise<SalesforceIdentity> {
  validateSalesforceUrl(url);
  const response = await fetch(url, {
    credentials: 'omit',
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  if (!response.ok) throw await oauthResponseError(response);
  return (await response.json()) as SalesforceIdentity;
}

async function fetchUserInfo(instanceUrl: string, sessionId: string): Promise<SalesforceIdentity> {
  const response = await fetch(`${instanceUrl}/services/oauth2/userinfo`, {
    credentials: 'omit',
    headers: { Authorization: `Bearer ${sessionId}`, Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new AppError({
      code: response.status === 401 ? 'AUTH_EXPIRED' : 'PERMISSION_DENIED',
      message: 'The active Salesforce browser session cannot be used for API access.',
      detail: 'Your org may enforce API Access Control. Use the optional OAuth connection instead.',
      status: response.status,
      retryable: true,
    });
  }
  return (await response.json()) as SalesforceIdentity;
}

async function oauthResponseError(response: Response): Promise<AppError> {
  let detail = `HTTP ${response.status}`;
  try {
    const body = (await response.json()) as { error?: string; error_description?: string };
    detail = body.error_description ?? body.error ?? detail;
  } catch {
    // Never include an untrusted HTML response.
  }
  return new AppError({
    code: response.status === 401 ? 'AUTH_EXPIRED' : 'SALESFORCE',
    message: 'Salesforce OAuth could not complete.',
    detail,
    status: response.status,
    retryable: true,
  });
}

function resolveLoginUrl(input: ConnectOrgInput): string {
  if (input.environment === 'production') return 'https://login.salesforce.com';
  if (input.environment === 'sandbox') return 'https://test.salesforce.com';
  return normalizeSalesforceLoginUrl(input.customDomain ?? '');
}

async function withRestClient<T>(
  key: string,
  action: (client: SalesforceRestClient, org: OrgIdentity, signal?: AbortSignal) => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  const org = await ensureKnownOrg(key);
  const execute = (session: OrgTokenSession) => {
    const transport = new SalesforceTransport({
      instanceUrl: session.instanceUrl,
      accessToken: session.accessToken,
    });
    return action(new SalesforceRestClient({ transport, apiVersion: org.apiVersion }), org, signal);
  };
  const session = await requireSession(key);
  try {
    return await execute(session);
  } catch (error) {
    if (isExpiredSession(error) && session.refreshToken) {
      return execute(await refreshSession(key, session));
    }
    throw error;
  }
}

async function withToolingClient<T>(
  key: string,
  action: (client: SalesforceToolingClient, org: OrgIdentity) => Promise<T>,
): Promise<T> {
  const org = await ensureKnownOrg(key);
  const execute = (session: OrgTokenSession) => {
    const transport = new SalesforceTransport({
      instanceUrl: session.instanceUrl,
      accessToken: session.accessToken,
    });
    return action(new SalesforceToolingClient({ transport, apiVersion: org.apiVersion }), org);
  };
  const session = await requireSession(key);
  try {
    return await execute(session);
  } catch (error) {
    if (isExpiredSession(error) && session.refreshToken) {
      return execute(await refreshSession(key, session));
    }
    throw error;
  }
}

async function withMetadataClient<T>(
  key: string,
  action: (client: SalesforceMetadataClient, org: OrgIdentity) => Promise<T>,
): Promise<T> {
  const org = await ensureKnownOrg(key);
  const execute = (session: OrgTokenSession) => {
    const transport = new SalesforceTransport({
      instanceUrl: session.instanceUrl,
      accessToken: session.accessToken,
    });
    return action(new SalesforceMetadataClient({ transport, apiVersion: org.apiVersion }), org);
  };
  const session = await requireSession(key);
  try {
    return await execute(session);
  } catch (error) {
    if (isExpiredSession(error) && session.refreshToken) {
      return execute(await refreshSession(key, session));
    }
    throw error;
  }
}

async function refreshSession(key: string, session: OrgTokenSession): Promise<OrgTokenSession> {
  if (session.source !== 'oauth' || !session.refreshToken) return session;
  const response = await fetch(`${session.loginUrl}/services/oauth2/token`, {
    method: 'POST',
    credentials: 'omit',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: CLIENT_ID,
      refresh_token: session.refreshToken,
    }),
  });
  if (!response.ok) {
    await chrome.storage.session.remove(tokenKey(key));
    throw new AppError({
      code: 'AUTH_EXPIRED',
      message: 'Salesforce could not refresh this session. Reconnect the org.',
      retryable: true,
    });
  }
  const refreshed = (await response.json()) as RefreshTokenResponse;
  const next: OrgTokenSession = {
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token ?? session.refreshToken,
    loginUrl: session.loginUrl,
    instanceUrl: refreshed.instance_url
      ? validateSalesforceUrl(refreshed.instance_url).origin
      : session.instanceUrl,
    issuedAt: refreshed.issued_at ?? new Date().toISOString(),
    source: 'oauth',
  };
  await chrome.storage.session.set({ [tokenKey(key)]: next });
  return next;
}

function isExpiredSession(error: unknown): error is AppError {
  return error instanceof AppError && error.data.code === 'AUTH_EXPIRED';
}

async function ensureKnownOrg(key: string): Promise<OrgIdentity> {
  const stored = await chrome.storage.local.get(ORGS_KEY);
  const orgs = (stored[ORGS_KEY] as OrgIdentity[] | undefined) ?? [];
  const org = orgs.find((candidate) => candidate.key === key);
  if (!org) {
    throw new AppError({
      code: 'INVALID_REQUEST',
      message: 'Select a known Salesforce org.',
      retryable: false,
    });
  }
  return org;
}

async function requireSession(key: string): Promise<OrgTokenSession> {
  const stored = await chrome.storage.session.get(tokenKey(key));
  let session = stored[tokenKey(key)] as OrgTokenSession | undefined;
  let org: OrgIdentity | undefined;
  if (!session) {
    org = await ensureKnownOrg(key);
    if (org.connectionSource === 'browser-session') {
      session = await recoverBrowserSession(org);
    }
  }
  if (!session) {
    throw new AppError({
      code: 'AUTH_EXPIRED',
      message: 'Reconnect this org to start a new secure browser session.',
      retryable: true,
    });
  }
  if (session.source === 'browser-session') {
    org ??= await ensureKnownOrg(key);
    const cookie = await findLiveBrowserSessionCookie(
      org.orgId,
      session.cookieDomain ? `https://${session.cookieDomain}` : org.instanceUrl,
    );
    if (!cookie) {
      await chrome.storage.session.remove(tokenKey(key));
      throw expiredBrowserSession();
    }
    const cookieDomain = cookie.domain.replace(/^\./, '');
    const instanceUrl = validateSalesforceUrl(`https://${cookieDomain}`).origin;
    const next = { ...session, accessToken: cookie.value, cookieDomain, instanceUrl };
    if (cookieDomain !== session.cookieDomain || instanceUrl !== session.instanceUrl) {
      await chrome.storage.session.set({
        [tokenKey(key)]: { ...next, accessToken: '' },
      });
    }
    return next;
  }
  return session;
}

async function recoverBrowserSession(org: OrgIdentity): Promise<OrgTokenSession | undefined> {
  const cookie = await findLiveBrowserSessionCookie(org.orgId, org.instanceUrl);
  if (!cookie) return undefined;
  const cookieDomain = cookie.domain.replace(/^\./, '');
  let instanceUrl: string;
  try {
    instanceUrl = validateSalesforceUrl(`https://${cookieDomain}`).origin;
  } catch {
    return undefined;
  }
  const session: OrgTokenSession = {
    accessToken: '',
    loginUrl: org.loginUrl,
    instanceUrl,
    issuedAt: new Date().toISOString(),
    source: 'browser-session',
    cookieDomain,
  };
  await chrome.storage.session.set({ [tokenKey(org.key)]: session });
  return session;
}

async function findLiveBrowserSessionCookie(
  orgId: string,
  preferredUrl?: string,
): Promise<chrome.cookies.Cookie | undefined> {
  let preferredCookie: chrome.cookies.Cookie | null = null;
  if (preferredUrl) {
    try {
      const preferredHost = normalizeSalesforceApiHost(new URL(preferredUrl).hostname);
      preferredCookie = await chrome.cookies.get({
        url: `https://${preferredHost}`,
        name: 'sid',
      });
    } catch {
      // Continue with the org-ID scan across supported Salesforce cookie domains.
    }
  }
  const availableCookies = await chrome.cookies.getAll({ name: 'sid', secure: true });
  const matchingPreferred =
    preferredCookie && cookieMatchesOrg(preferredCookie, orgId) ? preferredCookie : undefined;
  return selectApiSessionCookie(availableCookies, orgId, matchingPreferred);
}

function expiredBrowserSession(): AppError {
  return new AppError({
    code: 'AUTH_EXPIRED',
    message:
      'Varkole could not find an API-capable Salesforce session for this org. Refresh the Salesforce tab and try again.',
    retryable: true,
  });
}

async function disconnectOrg(key: string): Promise<ExtensionState> {
  const session = await chrome.storage.session.get(tokenKey(key));
  const token = session[tokenKey(key)] as OrgTokenSession | undefined;
  if (token?.source === 'oauth' && token.accessToken) {
    try {
      await fetch(`${token.loginUrl}/services/oauth2/revoke`, {
        method: 'POST',
        credentials: 'omit',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: token.accessToken }),
      });
    } catch {
      // Local secret removal must succeed even if the revoke endpoint is offline.
    }
  }
  await chrome.storage.session.remove(tokenKey(key));
  const stored = await chrome.storage.local.get([ORGS_KEY, SELECTED_ORG_KEY]);
  const orgs = ((stored[ORGS_KEY] as OrgIdentity[] | undefined) ?? []).filter(
    (org) => org.key !== key,
  );
  const selected = stored[SELECTED_ORG_KEY];
  await chrome.storage.local.set({
    [ORGS_KEY]: orgs,
    [SELECTED_ORG_KEY]: selected === key ? (orgs[0]?.key ?? '') : selected,
  });
  return getState();
}

async function runAbortable<T>(requestId: string, action: (signal: AbortSignal) => Promise<T>) {
  if (!requestId) throw new Error('Missing request ID.');
  const controller = new AbortController();
  activeRequests.set(requestId, controller);
  try {
    return await action(controller.signal);
  } finally {
    activeRequests.delete(requestId);
  }
}

function tokenKey(key: string) {
  return `${TOKEN_PREFIX}${key}`;
}

async function getAiStatus(): Promise<AiConnectionStatus> {
  const config = await loadAiConfig();
  if (!config) return { configured: false };
  const stored = await chrome.storage.session.get(AI_DATA_CONSENT_KEY);
  const consent = stored[AI_DATA_CONSENT_KEY] as AiDataConsent | undefined;
  return {
    configured: true,
    provider: config.provider,
    model: config.model,
    ...(config.region ? { region: config.region } : {}),
    dataConsentGranted: isAiDataConsentActive(consent, config.provider),
  };
}

async function configureAi(input: {
  provider: AiProvider;
  apiKey: string;
  model: string;
  region?: string;
}): Promise<AiConnectionStatus> {
  const previous = await loadAiConfig();
  const config: AiSessionConfig = {
    provider: input.provider,
    apiKey: input.apiKey.trim() || (previous?.provider === input.provider ? previous.apiKey : ''),
    model: input.model.trim(),
    ...(input.region?.trim() ? { region: input.region.trim() } : {}),
    expiresAt: new Date(Date.now() + AI_KEY_TTL_MS).toISOString(),
  };
  validateAiConfig(config);
  await requestAiResponse(
    config,
    [{ role: 'user', content: 'Connection test. Reply with the single word CONNECTED.' }],
    'No Salesforce data is included in this connection test.',
  );
  await Promise.all([
    chrome.storage.session.set({ [AI_CONFIG_KEY]: config }),
    chrome.storage.session.remove(AI_DATA_CONSENT_KEY),
    chrome.storage.local.remove(LEGACY_AI_REMEMBERED_CONFIG_KEY),
  ]);
  return getAiStatus();
}

async function grantAiDataConsent(): Promise<AiConnectionStatus> {
  const config = await requireAiConfig();
  await chrome.storage.session.set({
    [AI_DATA_CONSENT_KEY]: createAiDataConsent(config.provider),
  });
  return getAiStatus();
}

async function requireAiConfig(): Promise<AiSessionConfig> {
  const config = await loadAiConfig();
  if (!config) {
    throw new AppError({
      code: 'AUTH_CONFIG',
      message: 'Connect an AI provider before asking AI Agent.',
      retryable: false,
    });
  }
  validateAiConfig(config);
  return config;
}

async function requireAiDataConsent(provider: AiProvider): Promise<void> {
  const stored = await chrome.storage.session.get(AI_DATA_CONSENT_KEY);
  const consent = stored[AI_DATA_CONSENT_KEY] as AiDataConsent | undefined;
  if (isAiDataConsentActive(consent, provider)) return;
  throw new AppError({
    code: 'INVALID_REQUEST',
    message: 'Review and approve AI data sharing before asking AI Agent.',
    retryable: false,
  });
}

async function loadAiConfig(): Promise<AiSessionConfig | undefined> {
  const stored = await chrome.storage.session.get(AI_CONFIG_KEY);
  const config = stored[AI_CONFIG_KEY] as AiSessionConfig | undefined;
  if (!config) return undefined;
  if (!config.expiresAt || Date.parse(config.expiresAt) <= Date.now()) {
    await chrome.storage.session.remove([AI_CONFIG_KEY, AI_DATA_CONSENT_KEY]);
    return undefined;
  }
  try {
    validateAiConfig(config);
  } catch {
    await chrome.storage.session.remove([AI_CONFIG_KEY, AI_DATA_CONSENT_KEY]);
    return undefined;
  }
  return config;
}

async function getQueryHistory(key: string): Promise<SoqlHistoryEntry[]> {
  await ensureKnownOrg(key);
  const storageKey = queryHistoryKey(key);
  const stored = await chrome.storage.local.get(storageKey);
  const history = stored[storageKey];
  return Array.isArray(history) ? (history as SoqlHistoryEntry[]).slice(0, 50) : [];
}

async function saveQueryHistory(
  key: string,
  soql: string,
  mode: 'rest' | 'tooling',
): Promise<SoqlHistoryEntry[]> {
  await ensureKnownOrg(key);
  const normalized = soql.trim();
  if (!normalized || normalized.length > 20_000) {
    throw new AppError({
      code: 'INVALID_REQUEST',
      message: 'Query history accepts non-empty SOQL up to 20,000 characters.',
      retryable: false,
    });
  }
  const current = await getQueryHistory(key);
  const next = addQueryHistoryEntry(current, {
    id: crypto.randomUUID(),
    soql: normalized,
    mode,
    executedAt: new Date().toISOString(),
  });
  await chrome.storage.local.set({ [queryHistoryKey(key)]: next });
  return next;
}

async function deleteQueryHistory(key: string, id: string): Promise<SoqlHistoryEntry[]> {
  await ensureKnownOrg(key);
  const next = (await getQueryHistory(key)).filter((entry) => entry.id !== id);
  await chrome.storage.local.set({ [queryHistoryKey(key)]: next });
  return next;
}

async function clearQueryHistory(key: string): Promise<SoqlHistoryEntry[]> {
  await ensureKnownOrg(key);
  await chrome.storage.local.remove(queryHistoryKey(key));
  return [];
}

function queryHistoryKey(key: string): string {
  return `${QUERY_HISTORY_PREFIX}${key}`;
}
