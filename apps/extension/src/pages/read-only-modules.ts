import type { ReadOnlyQueryConfig } from './ReadOnlyQueryPage';
import { formatFlows, formatInstalledPackages } from './setup-inventory';
import { SETUP_PATHS } from './setup-navigation';

export const READ_ONLY_MODULES: Record<string, ReadOnlyQueryConfig> = {
  packages: {
    title: 'Installed Packages',
    eyebrow: 'Setup inventory · read-only',
    actionLabel: 'Load packages',
    expandTable: true,
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
    expandTable: true,
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
