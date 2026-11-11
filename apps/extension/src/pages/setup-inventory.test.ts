import { describe, expect, it } from 'vitest';
import { formatFlows, formatInstalledPackages, packageStateLabel } from './setup-inventory';

describe('setup inventory formatting', () => {
  it('formats installed package versions without exposing record IDs', () => {
    const result = formatInstalledPackages({
      totalSize: 1,
      done: true,
      elapsedMs: 12,
      records: [
        {
          SubscriberPackage: { Name: 'Acme Toolkit', NamespacePrefix: 'acme' },
          SubscriberPackageVersion: {
            Name: 'Spring',
            MajorVersion: 3,
            MinorVersion: 2,
            PatchVersion: 1,
            BuildNumber: 7,
            IsManaged: true,
            IsDeprecated: false,
            ReleaseState: 'Released',
          },
        },
      ],
    });

    expect(result.records).toEqual([
      {
        Package: 'Acme Toolkit',
        Namespace: 'acme',
        Type: 'Managed',
        Version: '3.2.1.7',
        VersionName: 'Spring',
        Release: 'Released',
        Status: 'Installed',
      },
    ]);
  });

  it('distinguishes active unmanaged flows from inactive managed flows', () => {
    const result = formatFlows({
      totalSize: 2,
      done: true,
      elapsedMs: 8,
      records: [
        {
          MasterLabel: 'Create Contact',
          DeveloperName: 'Create_Contact',
          NamespacePrefix: null,
          ActiveVersionId: '301000000000001AAA',
          ManageableState: 'unmanaged',
        },
        {
          MasterLabel: 'Packaged Flow',
          DeveloperName: 'Packaged_Flow',
          NamespacePrefix: 'pkg',
          ActiveVersionId: null,
          ManageableState: 'installed',
        },
      ],
    });

    expect(result.records[0]).toMatchObject({ Type: 'Unmanaged', Status: 'Active' });
    expect(result.records[1]).toMatchObject({ Type: 'Managed', Status: 'Inactive' });
    expect(result.records[0]).not.toHaveProperty('ManageableState');
  });

  it('labels metadata ownership without inventing package state', () => {
    expect(packageStateLabel('unmanaged')).toBe('Unmanaged');
    expect(packageStateLabel('installed', 'pkg')).toBe('Managed');
    expect(packageStateLabel(undefined)).toBe('Local');
  });
});
