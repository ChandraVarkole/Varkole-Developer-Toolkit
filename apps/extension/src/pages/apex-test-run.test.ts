import { describe, expect, it } from 'vitest';
import {
  failedTestResultsQuery,
  isTerminalTestStatus,
  parseTestRunProgress,
  testRunProgressQuery,
} from './apex-test-run';

describe('Apex test run queries', () => {
  it('builds bounded progress and failure queries from validated Salesforce IDs', () => {
    expect(testRunProgressQuery('707000000000001AAA')).toContain(
      "WHERE AsyncApexJobId = '707000000000001AAA'",
    );
    expect(failedTestResultsQuery('05m000000000001AAA')).toContain(
      "WHERE ApexTestRunResultId = '05m000000000001AAA' AND Outcome != 'Pass'",
    );
  });

  it('rejects identifiers before inserting them into internal SOQL', () => {
    expect(() => testRunProgressQuery("707x' OR Name != ''")).toThrow('invalid');
    expect(() => failedTestResultsQuery('not-an-id')).toThrow('invalid');
  });
});

describe('Apex test run progress', () => {
  it('parses Salesforce summary values and recognizes terminal states', () => {
    expect(
      parseTestRunProgress({
        Id: '05m000000000001AAA',
        Status: 'Completed',
        MethodsEnqueued: 14,
        MethodsCompleted: 14,
        MethodsFailed: 2,
        TestTime: 912,
      }),
    ).toEqual({
      runResultId: '05m000000000001AAA',
      status: 'Completed',
      methodsEnqueued: 14,
      methodsCompleted: 14,
      methodsFailed: 2,
      testTimeMs: 912,
    });
    expect(isTerminalTestStatus('Completed')).toBe(true);
    expect(isTerminalTestStatus('Failed')).toBe(true);
    expect(isTerminalTestStatus('Processing')).toBe(false);
  });
});
