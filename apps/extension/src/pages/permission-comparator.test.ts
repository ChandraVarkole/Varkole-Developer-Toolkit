import { describe, expect, it } from 'vitest';
import {
  buildPermissionSnapshot,
  comparePermissionSnapshots,
  matchingPermissionSources,
  permissionSourcesFromRecords,
  systemPermissionFieldNames,
} from './permission-comparator';

describe('permission comparator', () => {
  it('keeps profiles and permission sets distinct and sorted', () => {
    const sources = permissionSourcesFromRecords([
      {
        Id: '0PS000000000002AAA',
        Name: 'Support_Access',
        Label: 'Support Access',
        IsOwnedByProfile: false,
      },
      {
        Id: '0PS000000000001AAA',
        Name: 'Admin',
        Label: 'Internal profile label',
        IsOwnedByProfile: true,
        Profile: { Name: 'System Administrator' },
      },
    ]);

    expect(sources.map((source) => [source.kind, source.label])).toEqual([
      ['profile', 'System Administrator'],
      ['permission-set', 'Support Access'],
    ]);
  });

  it('selects only boolean PermissionSet system permission fields', () => {
    expect(
      systemPermissionFieldNames({
        fields: [
          { name: 'PermissionsApiEnabled', type: 'boolean' },
          { name: 'PermissionsLabel', type: 'string' },
          { name: 'IsOwnedByProfile', type: 'boolean' },
        ] as never,
      }),
    ).toEqual(['PermissionsApiEnabled']);
  });

  it('searches only the requested source type after two characters', () => {
    const sources = permissionSourcesFromRecords([
      {
        Id: '0PS000000000001AAA',
        Name: 'Admin',
        Label: 'Internal profile label',
        IsOwnedByProfile: true,
        Profile: { Name: 'System Administrator' },
      },
      {
        Id: '0PS000000000002AAA',
        Name: 'Admin_Tools',
        Label: 'Admin Tools',
        IsOwnedByProfile: false,
      },
    ]);

    expect(matchingPermissionSources(sources, 'a', 'profile')).toEqual([]);
    expect(
      matchingPermissionSources(sources, 'adm', 'profile').map((source) => source.label),
    ).toEqual(['System Administrator']);
    expect(
      matchingPermissionSources(sources, 'admin_', 'permission-set').map(
        (source) => source.apiName,
      ),
    ).toEqual(['Admin_Tools']);
  });

  it('reports grants on each side and highlights differences', () => {
    const leftSource = {
      id: '0PS000000000001AAA',
      kind: 'profile' as const,
      label: 'Admin',
      apiName: 'Admin',
    };
    const rightSource = {
      id: '0PS000000000002AAA',
      kind: 'permission-set' as const,
      label: 'Support',
      apiName: 'Support',
    };
    const left = buildPermissionSnapshot(leftSource, ['PermissionsApiEnabled'], {
      system: [{ PermissionsApiEnabled: true }],
      objects: [{ SObjectType: 'Case', PermissionsRead: true, PermissionsEdit: true }],
    });
    const right = buildPermissionSnapshot(rightSource, ['PermissionsApiEnabled'], {
      system: [{ PermissionsApiEnabled: false }],
      objects: [{ SObjectType: 'Case', PermissionsRead: true, PermissionsEdit: false }],
    });

    const entries = comparePermissionSnapshots(left, right);
    expect(entries).toContainEqual(
      expect.objectContaining({
        category: 'System permissions',
        label: 'API Enabled',
        left: 'Granted',
        right: 'Not granted',
        differs: true,
      }),
    );
    expect(entries).toContainEqual(
      expect.objectContaining({
        category: 'Object permissions',
        label: 'Case',
        left: 'Read, Edit',
        right: 'Read',
        differs: true,
      }),
    );
  });

  it('keeps matching denied system permissions available when differences are shown', () => {
    const source = {
      id: '0PS000000000001AAA',
      kind: 'profile' as const,
      label: 'Admin',
      apiName: 'Admin',
    };
    const left = buildPermissionSnapshot(source, ['PermissionsManageUsers'], {
      system: [{ PermissionsManageUsers: false }],
    });
    const right = buildPermissionSnapshot(
      { ...source, id: '0PS000000000002AAA', label: 'Standard User' },
      ['PermissionsManageUsers'],
      { system: [{ PermissionsManageUsers: false }] },
    );

    expect(comparePermissionSnapshots(left, right)).toContainEqual(
      expect.objectContaining({
        label: 'Manage Users',
        left: 'Not granted',
        right: 'Not granted',
        differs: false,
      }),
    );
  });
});
