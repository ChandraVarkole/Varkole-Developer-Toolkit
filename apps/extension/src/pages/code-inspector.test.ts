import { describe, expect, it } from 'vitest';
import {
  activeRecordPageOverride,
  codeFilesFromRecords,
  codeResourcesFromDependencies,
  customTabTargetQueries,
  customTabDependencyQuery,
  directContextQueries,
  flowComponentQueriesFromRecords,
  pageContextFromSalesforceUrl,
  pickedComponentQueries,
  flowTargetQueries,
  quickActionTargetQueries,
  recordTriggerQuery,
  quickActionDependencyQuery,
  sourceQuery,
  type CodeResource,
} from './code-inspector';

describe('Code Inspector context helpers', () => {
  it('detects the exact Visualforce page instead of requesting an org inventory', () => {
    const context = pageContextFromSalesforceUrl(
      'https://acme--c.vf.force.com/apex/InvoiceConsole?id=a001G00000ABCdeQAH',
    );
    expect(context).toMatchObject({ experience: 'Classic', visualforceName: 'InvoiceConsole' });
    const [query] = directContextQueries(context);
    expect(query?.kind).toBe('Visualforce page');
    expect(query?.query).toContain("Name = 'InvoiceConsole'");
  });

  it('resolves a Lightning navigation item through its Custom Tab target', () => {
    const context = pageContextFromSalesforceUrl(
      'https://acme.lightning.force.com/lightning/n/SocioWatch_Settings',
    );
    expect(context).toMatchObject({
      experience: 'Lightning',
      navigationTabName: 'SocioWatch_Settings',
    });
    const [query] = customTabTargetQueries({
      fullName: 'SocioWatch_Settings',
      label: 'SocioWatch Settings',
      auraComponent: 'c:socioWatchSettings',
    });
    expect(query?.kind).toBe('Aura');
    expect(query?.query).toContain("DeveloperName = 'socioWatchSettings'");
    expect(query?.query).not.toContain('ManageableState');
    expect(customTabDependencyQuery('SocioWatch_Settings')).toContain(
      "MetadataComponentType = 'CustomTab'",
    );
  });

  it('uses the current-user record page override and the current object triggers', () => {
    expect(
      activeRecordPageOverride(
        {
          name: 'Invoice__c',
          label: 'Invoice',
          fields: [],
          childRelationships: [],
          actionOverrides: [
            { name: 'View', formFactor: 'Small', pageId: '0M0000000000001AAA' },
            { name: 'View', formFactor: 'Large', pageId: '0M0000000000002AAA' },
          ],
        },
        'Lightning',
      ),
    ).toMatchObject({ pageId: '0M0000000000002AAA' });
    expect(recordTriggerQuery('Invoice__c')).toContain("TableEnumOrId = 'Invoice__c'");
  });

  it('builds exact selected-component queries without an org-wide inventory', () => {
    const [namespaced] = pickedComponentQueries({
      componentName: 'resultSalesAppointment',
      kindHint: 'lwc',
      namespace: 'i360core',
    });
    expect(namespaced?.kind).toBe('LWC');
    expect(namespaced?.relationship).toBe('Selected component');
    expect(namespaced?.query).toContain(
      "DeveloperName = 'resultSalesAppointment' AND NamespacePrefix = 'i360core'",
    );
    expect(
      pickedComponentQueries({ componentName: 'localAction', kindHint: 'aura', namespace: 'c' })[0]
        ?.query,
    ).toContain("DeveloperName = 'localAction' AND NamespacePrefix = null");
  });

  it('resolves a selected quick action through Salesforce dependency metadata', () => {
    const query = quickActionDependencyQuery('Account.Create_Address');
    expect(query).toContain("MetadataComponentType = 'QuickAction'");
    expect(query).toContain("'Account.Create_Address', 'Create_Address'");
  });

  it('resolves Flow quick actions to the active Flow version', () => {
    const [definition] = quickActionTargetQueries({
      fullName: 'Account.Create_Address',
      type: 'Flow',
      flowDefinition: 'Create_Address_Flow',
    });
    expect(definition?.kind).toBe('Flow');
    expect(definition?.query).toContain("DeveloperName = 'Create_Address_Flow'");
    expect(flowTargetQueries('Create_Address_Flow')[0]?.query).toContain('ActiveVersionId');

    const flow = codeResourcesFromDependencies([
      {
        MetadataComponentId: '0M0000000000002AAA',
        RefMetadataComponentId: '300000000000001AAA',
        RefMetadataComponentName: 'Create_Address_Flow',
        RefMetadataComponentType: 'Flow',
      },
    ])[0];
    expect(flow).toMatchObject({ kind: 'Flow', name: 'Create_Address_Flow' });
  });

  it('finds accessible custom screen components in Flow metadata', () => {
    const queries = flowComponentQueriesFromRecords([
      {
        Metadata: {
          screens: [
            {
              fields: [
                { extensionName: 'c:addressSelector' },
                { extensionName: 'acme__salesOpportunityPicker' },
                { extensionName: 'flowruntime:standardNavigation' },
              ],
            },
          ],
        },
      },
    ]);
    expect(queries).toHaveLength(4);
    expect(queries.map((definition) => definition.query).join('\n')).toContain(
      "DeveloperName = 'addressSelector' AND NamespacePrefix = null",
    );
    expect(queries.map((definition) => definition.query).join('\n')).toContain(
      "DeveloperName = 'salesOpportunityPicker' AND NamespacePrefix = 'acme'",
    );
    expect(queries.map((definition) => definition.query).join('\n')).not.toContain(
      'standardNavigation',
    );
  });

  it('keeps only supported UI and Apex dependencies', () => {
    expect(
      codeResourcesFromDependencies([
        {
          MetadataComponentId: '0M0000000000002AAA',
          RefMetadataComponentId: '0Rb000000000001AAA',
          RefMetadataComponentName: 'invoicePanel',
          RefMetadataComponentType: 'LightningComponentBundle',
        },
        {
          MetadataComponentId: '0M0000000000002AAA',
          RefMetadataComponentId: '00N000000000001AAA',
          RefMetadataComponentName: 'Invoice_Status__c',
          RefMetadataComponentType: 'CustomField',
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        name: 'invoicePanel',
        kind: 'LWC',
        relationship: 'Related component',
      }),
    ]);
  });

  it('builds bounded source queries and readable files', () => {
    const resource: CodeResource = {
      id: '0Rb000000000001AAA',
      name: 'invoicePanel',
      kind: 'LWC',
      relationship: 'Current page',
    };
    expect(sourceQuery(resource)).toContain('LightningComponentResource');
    expect(
      codeFilesFromRecords(resource, [
        { FilePath: 'lwc/invoicePanel/invoicePanel.js', Format: 'js', Source: 'export default {}' },
      ]),
    ).toEqual([
      {
        name: 'lwc/invoicePanel/invoicePanel.js',
        format: 'js',
        source: 'export default {}',
      },
    ]);
  });
});
