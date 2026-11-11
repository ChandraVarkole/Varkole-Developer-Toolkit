import type { ApiMode } from '@varkole/shared';
import { SETUP_PATHS } from './setup-navigation';

export interface IntegrationQueryConfig {
  id: string;
  title: string;
  description: string;
  mode: ApiMode;
  query: string;
  columnLabels: Record<string, string>;
  setupPath: string;
}

export const INTEGRATION_QUERIES: IntegrationQueryConfig[] = [
  {
    id: 'connected-apps',
    title: 'Connected Apps',
    description: 'OAuth applications registered in this org.',
    mode: 'rest',
    setupPath: SETUP_PATHS.connectedApps,
    query:
      'SELECT Name, OptionsAllowAdminApprovedUsersOnly, OptionsHasSessionLevelPolicy, OptionsIsInternal, LastModifiedDate FROM ConnectedApplication ORDER BY Name',
    columnLabels: {
      Name: 'Application',
      OptionsAllowAdminApprovedUsersOnly: 'Admin approved users only',
      OptionsHasSessionLevelPolicy: 'Session policy',
      OptionsIsInternal: 'Salesforce internal',
      LastModifiedDate: 'Last modified',
    },
  },
  {
    id: 'named-credentials',
    title: 'Named Credentials',
    description: 'Callout endpoints and authentication configuration. Secrets are never read.',
    mode: 'tooling',
    setupPath: SETUP_PATHS.namedCredentials,
    query:
      'SELECT MasterLabel, DeveloperName, NamespacePrefix, NamedCredentialType, CalloutStatus, Endpoint FROM NamedCredential ORDER BY MasterLabel',
    columnLabels: {
      MasterLabel: 'Named credential',
      DeveloperName: 'API name',
      NamespacePrefix: 'Namespace prefix',
      NamedCredentialType: 'Type',
      CalloutStatus: 'Status',
      Endpoint: 'Endpoint',
    },
  },
  {
    id: 'external-credentials',
    title: 'External Credentials',
    description:
      'Authentication protocols and package ownership. Principal secrets are never read.',
    mode: 'tooling',
    setupPath: SETUP_PATHS.namedCredentials,
    query:
      'SELECT MasterLabel, DeveloperName, NamespacePrefix, AuthenticationProtocol, ManageableState FROM ExternalCredential ORDER BY MasterLabel',
    columnLabels: {
      MasterLabel: 'External credential',
      DeveloperName: 'API name',
      NamespacePrefix: 'Namespace prefix',
      AuthenticationProtocol: 'Authentication protocol',
      ManageableState: 'Manageable state',
    },
  },
];
