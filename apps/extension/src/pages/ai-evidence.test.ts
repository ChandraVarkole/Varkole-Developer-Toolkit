import { describe, expect, it } from 'vitest';
import type { QueryPage, SalesforceObjectDescribe } from '@varkole/shared';
import {
  buildDeterministicRecordQueries,
  evidenceAnswerIssue,
  mergeQueryPages,
  relationshipEvidenceForQuery,
  selectRelevantAiObjects,
  shouldRequestDataGapPlan,
  shouldRequestRelationshipGapPlan,
} from './ai-evidence';

const page = (records: QueryPage['records'], done = true, nextRecordsUrl?: string): QueryPage => ({
  totalSize: records.length,
  done,
  records,
  ...(nextRecordsUrl ? { nextRecordsUrl } : {}),
  elapsedMs: 1,
});

describe('AI Salesforce evidence', () => {
  it('accepts direct Case.ContactId evidence even when a CaseContactRole query is empty', () => {
    const observations = [
      {
        query: "SELECT Id, CaseNumber, ContactId FROM Case WHERE ContactId = '003x' LIMIT 200",
        result: page([{ Id: '500x', CaseNumber: '00001029', ContactId: '003x' }]),
      },
      {
        query: "SELECT Id FROM CaseContactRole WHERE ContactId = '003x' LIMIT 200",
        result: page([]),
      },
    ];
    expect(
      shouldRequestRelationshipGapPlan('Show Cases related to George Bush', observations),
    ).toBe(false);
  });

  it('requires direct Case relationship evidence instead of only CaseContactRole', () => {
    expect(
      shouldRequestRelationshipGapPlan('Show Cases related to George Bush', [
        {
          query: "SELECT Id FROM CaseContactRole WHERE ContactId = '003x' LIMIT 200",
          result: page([]),
        },
      ]),
    ).toBe(true);
  });

  it('distinguishes success, zero results, and API errors in answer validation', () => {
    expect(
      evidenceAnswerIssue('Found two matching Contacts. [E1]', [
        {
          query: "SELECT Id, Name FROM Contact WHERE Name = 'George Bush' LIMIT 200",
          result: page([
            { Id: '003a', Name: 'George Bush' },
            { Id: '003b', Name: 'George Bush' },
          ]),
        },
      ]),
    ).toBeUndefined();
    expect(
      evidenceAnswerIssue('No records matched this query. [E1]', [
        { query: 'SELECT Id FROM Case LIMIT 20', error: 'Salesforce denied this query.' },
      ]),
    ).toContain('zero records');
  });

  it('flags unsupported follow-up claims instead of trusting prior assistant prose', () => {
    expect(evidenceAnswerIssue('The lookup returned Case 00001029.', [])).toContain(
      'without a successful',
    );
  });

  it('merges paginated results and preserves incomplete state at the safety bound', () => {
    const merged = mergeQueryPages(
      [
        page([{ Id: '1' }, { Id: '2' }], false, '/next'),
        page([{ Id: '3' }, { Id: '4' }], false, '/next-2'),
      ],
      3,
    );
    expect(merged.records).toHaveLength(3);
    expect(merged.done).toBe(false);
    expect(merged.nextRecordsUrl).toBeUndefined();
  });

  it('records the direct relationships inspected by a query', () => {
    expect(
      relationshipEvidenceForQuery(
        "SELECT CaseNumber, ContactId, Contact.Name, Account.Name FROM Case WHERE ContactId = '003x'",
      ),
    ).toEqual(['Case', 'Case.ContactId', 'Case.Contact', 'Case.Account']);
  });

  it('requests another plan when record or aggregate evidence is missing', () => {
    expect(shouldRequestDataGapPlan('Show me recent Accounts', [])).toBe(true);
    expect(
      shouldRequestDataGapPlan('How many Accounts are active?', [
        { query: 'SELECT Id FROM Account LIMIT 20', result: page([{ Id: '001x' }]) },
      ]),
    ).toBe(true);
    expect(
      shouldRequestDataGapPlan('How many Accounts are active?', [
        { query: 'SELECT COUNT() total FROM Account LIMIT 20', result: page([{ total: 12 }]) },
      ]),
    ).toBe(false);
    expect(
      shouldRequestDataGapPlan(
        'Show the oldest Account',
        [{ query: 'SELECT Id FROM User LIMIT 1', result: page([{ Id: '005x' }]) }],
        ['Account'],
      ),
    ).toBe(true);
  });

  it('builds a deterministic oldest-record query from described accessible fields', () => {
    const account = {
      name: 'Account',
      label: 'Accounts',
      custom: false,
      queryable: true,
      searchable: true,
    };
    const fields = [
      { name: 'Id', label: 'Account ID', type: 'id', sortable: true, nameField: false },
      { name: 'Name', label: 'Account Name', type: 'string', sortable: true, nameField: true },
      {
        name: 'CreatedDate',
        label: 'Created Date',
        type: 'datetime',
        sortable: true,
        nameField: false,
      },
    ].map((field) => ({
      ...field,
      custom: false,
      nillable: false,
      filterable: true,
      createable: false,
      updateable: false,
    }));
    expect(
      buildDeterministicRecordQueries(
        'Get the oldest Account',
        [account],
        [{ name: 'Account', label: 'Account', fields, childRelationships: [] }],
      ),
    ).toEqual([
      'SELECT Id, Name, CreatedDate FROM Account ORDER BY CreatedDate ASC, Id ASC LIMIT 1',
    ]);
  });

  it('prioritizes report, dashboard, flow, and permission objects from user intent', () => {
    const objects = [
      'Account',
      'Report',
      'Dashboard',
      'FlowDefinitionView',
      'PermissionSetAssignment',
    ].map((name) => ({ name, label: name, custom: false, queryable: true, searchable: true }));
    expect(selectRelevantAiObjects(objects, 'Analyze a report and dashboard', 2)).toEqual([
      'Dashboard',
      'Report',
    ]);
    expect(selectRelevantAiObjects(objects, 'Help me design a flow', 1)).toEqual([
      'FlowDefinitionView',
    ]);
  });
});

// Compile-time fixture: relationship metadata remains structured and cannot be confused with data.
const describeFixture: SalesforceObjectDescribe = {
  name: 'Contact',
  label: 'Contact',
  fields: [],
  childRelationships: [
    { childSObject: 'Case', field: 'ContactId', relationshipName: 'Cases', cascadeDelete: false },
  ],
};
void describeFixture;
