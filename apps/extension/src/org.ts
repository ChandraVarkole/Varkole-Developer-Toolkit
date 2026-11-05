import type { OrgIdentity } from '@varkole/shared';

export function orgName(org: OrgIdentity): string {
  return org.alias || org.organizationName || org.orgId;
}
