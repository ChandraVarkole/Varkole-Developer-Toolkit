import type { OrgIdentity } from '@varkole/shared';

export const SETUP_PATHS = {
  flows: '/lightning/setup/Flows/home',
  appManager: '/lightning/setup/NavigationMenus/home',
  connectedApps: '/lightning/setup/ConnectedApplication/home',
  namedCredentials: '/lightning/setup/NamedCredential/home',
} as const;

const ALLOWED_SETUP_PATHS = new Set<string>(Object.values(SETUP_PATHS));

export function salesforceSetupUrl(
  org: Pick<OrgIdentity, 'instanceUrl'>,
  setupPath: string,
): string | undefined {
  if (!ALLOWED_SETUP_PATHS.has(setupPath)) return undefined;
  try {
    const origin = new URL(org.instanceUrl).origin;
    return new URL(setupPath, `${origin}/`).toString();
  } catch {
    return undefined;
  }
}
