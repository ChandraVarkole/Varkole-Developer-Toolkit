import { describe, expect, it } from 'vitest';
import {
  codeFilesFromRecords,
  codeResourceFromRecord,
  relatedCodeResources,
  sourceQuery,
  type CodeResource,
} from './code-inspector';

describe('Code Inspector helpers', () => {
  it('normalizes local Tooling API inventory rows', () => {
    expect(
      codeResourceFromRecord('Apex trigger', {
        Id: '01q000000000001AAA',
        Name: 'AccountTrigger',
        ApiVersion: 68,
        TableEnumOrId: 'Account',
      }),
    ).toMatchObject({ name: 'AccountTrigger', objectApiName: 'Account', apiVersion: '68' });
  });

  it('builds bounded source queries and files', () => {
    const resource: CodeResource = {
      id: '0Rb000000000001AAA',
      name: 'accountPanel',
      kind: 'LWC',
    };
    expect(sourceQuery(resource)).toContain('LightningComponentResource');
    expect(
      codeFilesFromRecords(resource, [
        { FilePath: 'lwc/accountPanel/accountPanel.js', Format: 'js', Source: 'export default {}' },
      ]),
    ).toEqual([
      {
        name: 'lwc/accountPanel/accountPanel.js',
        format: 'js',
        source: 'export default {}',
      },
    ]);
  });

  it('finds accessible resources referenced by source', () => {
    const selected: CodeResource = {
      id: '01p000000000001AAA',
      name: 'AccountController',
      kind: 'Apex class',
    };
    const related: CodeResource = {
      id: '01p000000000002AAA',
      name: 'AccountService',
      kind: 'Apex class',
    };
    expect(
      relatedCodeResources(
        selected,
        [{ name: 'AccountController', source: 'AccountService.loadAccounts();' }],
        [selected, related],
      ),
    ).toEqual([related]);
  });
});
