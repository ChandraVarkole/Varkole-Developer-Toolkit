import type { QueryRecord } from '@varkole/shared';

export interface ApexTestRunProgress {
  runResultId: string;
  status: string;
  methodsEnqueued: number;
  methodsCompleted: number;
  methodsFailed: number;
  startTime?: string | undefined;
  endTime?: string | undefined;
  testTimeMs?: number | undefined;
}

const TERMINAL_TEST_STATUSES = new Set(['Completed', 'Failed', 'Aborted']);

export function testRunProgressQuery(jobId: string): string {
  requireSalesforceId(jobId, '707');
  return (
    'SELECT Id, Status, MethodsEnqueued, MethodsCompleted, MethodsFailed, ' +
    `StartTime, EndTime, TestTime FROM ApexTestRunResult WHERE AsyncApexJobId = '${jobId}' ` +
    'ORDER BY CreatedDate DESC LIMIT 1'
  );
}

export function failedTestResultsQuery(runResultId: string): string {
  requireSalesforceId(runResultId);
  return (
    'SELECT ApexClass.Name, MethodName, Outcome, Message, StackTrace, RunTime ' +
    `FROM ApexTestResult WHERE ApexTestRunResultId = '${runResultId}' AND Outcome != 'Pass' ` +
    'ORDER BY ApexClass.Name, MethodName LIMIT 200'
  );
}

export function parseTestRunProgress(record: QueryRecord): ApexTestRunProgress {
  const runResultId = text(record.Id);
  requireSalesforceId(runResultId);
  return {
    runResultId,
    status: text(record.Status) || 'Queued',
    methodsEnqueued: number(record.MethodsEnqueued),
    methodsCompleted: number(record.MethodsCompleted),
    methodsFailed: number(record.MethodsFailed),
    ...(text(record.StartTime) ? { startTime: text(record.StartTime) } : {}),
    ...(text(record.EndTime) ? { endTime: text(record.EndTime) } : {}),
    ...(Number.isFinite(Number(record.TestTime)) ? { testTimeMs: number(record.TestTime) } : {}),
  };
}

export function isTerminalTestStatus(status: string): boolean {
  return TERMINAL_TEST_STATUSES.has(status);
}

function requireSalesforceId(value: string, prefix?: string): void {
  const pattern = prefix
    ? new RegExp(`^${prefix}[A-Za-z0-9]{12}(?:[A-Za-z0-9]{3})?$`)
    : /^[A-Za-z0-9]{15}(?:[A-Za-z0-9]{3})?$/;
  if (!pattern.test(value)) throw new Error('Salesforce returned an invalid Apex test identifier.');
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function number(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
