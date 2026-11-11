import type { ReadOnlyQueryConfig } from './ReadOnlyQueryPage';
import { formatFlows, formatInstalledPackages } from './setup-inventory';
import { SETUP_PATHS } from './setup-navigation';

export const READ_ONLY_MODULES: Record<string, ReadOnlyQueryConfig> = {
  users: {
    title: 'Users',
    eyebrow: 'Administration · read-only',
    actionLabel: 'Load users',
    mode: 'rest',
    columnLabels: {
      Name: 'Name',
      Username: 'Username',
      Email: 'Email',
      IsActive: 'Active',
      UserType: 'User type',
      'Profile.Name': 'Profile',
      LastLoginDate: 'Last login',
    },
    query:
      'SELECT Name, Username, Email, IsActive, UserType, Profile.Name, LastLoginDate FROM User ORDER BY Name LIMIT 200',
  },
  access: {
    title: 'Access Assignments',
    eyebrow: 'Administration · read-only',
    actionLabel: 'Load assignments',
    mode: 'rest',
    columnLabels: {
      'Assignee.Name': 'User',
      'Assignee.Username': 'Username',
      'PermissionSet.Label': 'Permission set',
      'PermissionSet.IsOwnedByProfile': 'From profile',
    },
    query:
      'SELECT Assignee.Name, Assignee.Username, PermissionSet.Label, PermissionSet.IsOwnedByProfile FROM PermissionSetAssignment ORDER BY Assignee.Name LIMIT 200',
  },
  packages: {
    title: 'Installed Packages',
    eyebrow: 'Setup inventory · read-only',
    actionLabel: 'Load packages',
    mode: 'tooling',
    transformResult: formatInstalledPackages,
    columnLabels: {
      Package: 'Package',
      Namespace: 'Namespace prefix',
      Type: 'Package type',
      Version: 'Version',
      VersionName: 'Version name',
      Release: 'Release state',
      Status: 'Status',
    },
    query:
      'SELECT SubscriberPackage.Name, SubscriberPackage.NamespacePrefix, SubscriberPackageVersion.Name, SubscriberPackageVersion.MajorVersion, SubscriberPackageVersion.MinorVersion, SubscriberPackageVersion.PatchVersion, SubscriberPackageVersion.BuildNumber, SubscriberPackageVersion.IsManaged, SubscriberPackageVersion.IsDeprecated, SubscriberPackageVersion.ReleaseState FROM InstalledSubscriberPackage ORDER BY SubscriberPackage.Name',
  },
  flows: {
    title: 'Flows',
    eyebrow: 'Automation inventory · read-only',
    actionLabel: 'Load flows',
    mode: 'tooling',
    setupPath: SETUP_PATHS.flows,
    transformResult: formatFlows,
    columnLabels: {
      Name: 'Flow',
      ApiName: 'API name',
      Namespace: 'Namespace prefix',
      Type: 'Package type',
      Status: 'Status',
    },
    query:
      'SELECT DeveloperName, MasterLabel, NamespacePrefix, ActiveVersionId, ManageableState FROM FlowDefinition ORDER BY MasterLabel',
  },
};
