import type { OrgIdentity } from '@varkole/shared';

export const SETUP_PATHS = {
  flows: '/lightning/setup/Flows/home',
  appManager: '/lightning/setup/NavigationMenus/home',
  connectedApps: '/lightning/setup/ConnectedApplication/home',
  namedCredentials: '/lightning/setup/NamedCredential/home',
  debugMode: '/lightning/setup/UserDebugModeSetup/home',
  sessionSettings: '/lightning/setup/SecuritySession/home',
  apexTestExecution: '/lightning/setup/ApexTestQueue/home',
  debugLogs: '/lightning/setup/ApexDebugLogs/home',
  remoteSites: '/lightning/setup/SecurityRemoteProxy/home',
} as const;

const ALLOWED_SETUP_PATHS = new Set<string>(Object.values(SETUP_PATHS));

export function salesforceSetupUrl(
  org: Pick<OrgIdentity, 'instanceUrl'>,
  setupPath: string,
): string | undefined {
  if (!ALLOWED_SETUP_PATHS.has(setupPath)) return undefined;
  try {
    const instance = new URL(org.instanceUrl);
    const setupHost = instance.hostname
      .replace(/\.my\.salesforce\.com$/, '.my.salesforce-setup.com')
      .replace(/\.salesforce\.com$/, '.salesforce-setup.com');
    return new URL(setupPath, `${instance.protocol}//${setupHost}/`).toString();
  } catch {
    return undefined;
  }
}
