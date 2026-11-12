import { useCallback, useEffect, useState } from 'react';
import type { ApexTestRunSubmission, OrgIdentity, QueryPage } from '@varkole/shared';
import { sendMessage } from '../api';
import { QueryResults } from '../components/QueryResults';
import { EmptyState, InlineError } from '../components/Status';
import { useAutoLoad } from '../useAutoLoad';
import {
  failedTestResultsQuery,
  isTerminalTestStatus,
  parseTestRunProgress,
  testRunProgressQuery,
  type ApexTestRunProgress,
} from './apex-test-run';
import { addCoveragePercentages, orgWideCoveragePercentage } from './coverage-utils';

const COVERAGE_QUERY =
  'SELECT ApexClassOrTrigger.Name, NumLinesCovered, NumLinesUncovered FROM ApexCodeCoverageAggregate ORDER BY ApexClassOrTrigger.Name LIMIT 200';
const ORG_WIDE_COVERAGE_QUERY = 'SELECT PercentCovered FROM ApexOrgWideCoverage';

const COVERAGE_LABELS = {
  Name: 'File',
  Coverage: 'Coverage',
  CoveredLines: 'Covered',
  UncoveredLines: 'Uncovered',
  TotalLines: 'Total lines',
};

const FAILURE_LABELS = {
  'ApexClass.Name': 'Test class',
  MethodName: 'Test method',
  Outcome: 'Outcome',
  Message: 'Failure message',
  StackTrace: 'Stack trace',
  RunTime: 'Run time (seconds)',
};

export function CoveragePage({ org }: { org?: OrgIdentity | undefined }) {
  const [coverage, setCoverage] = useState<QueryPage>();
  const [overallCoverage, setOverallCoverage] = useState<number>();
  const [coverageError, setCoverageError] = useState<string>();
  const [coverageLoading, setCoverageLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [productionText, setProductionText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [testJobId, setTestJobId] = useState<string>();
  const [testProgress, setTestProgress] = useState<ApexTestRunProgress>();
  const [testFailures, setTestFailures] = useState<QueryPage>();
  const [testError, setTestError] = useState<string>();

  const loadCoverage = useCallback(async () => {
    if (!org) return;
    setCoverageLoading(true);
    setCoverageError(undefined);
    setOverallCoverage(undefined);
    try {
      const [page, nextOverallCoverage] = await Promise.all([
        runToolingQuery(org, COVERAGE_QUERY),
        runToolingQuery(org, ORG_WIDE_COVERAGE_QUERY)
          .then(orgWideCoveragePercentage)
          .catch(() => undefined),
      ]);
      setCoverage(addCoveragePercentages(page));
      setOverallCoverage(nextOverallCoverage);
    } catch (cause) {
      setCoverageError(
        cause instanceof Error ? cause.message : 'Salesforce could not load code coverage.',
      );
    } finally {
      setCoverageLoading(false);
    }
  }, [org]);

  const loadTestFailures = useCallback(
    async (runResultId: string) => {
      if (!org) return;
      const page = await runToolingQuery(org, failedTestResultsQuery(runResultId));
      setTestFailures(page);
    },
    [org],
  );

  useEffect(() => {
    if (!org || !testJobId) return;
    const selectedOrg = org;
    const jobId = testJobId;
    let cancelled = false;
    let timer: number | undefined;

    async function poll() {
      try {
        const page = await runToolingQuery(selectedOrg, testRunProgressQuery(jobId));
        if (cancelled) return;
        const record = page.records[0];
        if (record) {
          const next = parseTestRunProgress(record);
          setTestProgress(next);
          if (isTerminalTestStatus(next.status)) {
            try {
              await Promise.all([loadCoverage(), loadTestFailures(next.runResultId)]);
            } catch (cause) {
              if (!cancelled) {
                setTestError(
                  cause instanceof Error
                    ? cause.message
                    : 'Salesforce could not load the completed test details.',
                );
              }
            }
            return;
          }
        }
        timer = window.setTimeout(() => void poll(), 3_000);
      } catch (cause) {
        if (!cancelled) {
          setTestError(
            cause instanceof Error ? cause.message : 'Salesforce could not check the test run.',
          );
        }
      }
    }

    timer = window.setTimeout(() => void poll(), 750);
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [loadCoverage, loadTestFailures, org, testJobId]);

  useAutoLoad(loadCoverage, org ? `${org.key}:coverage` : undefined);

  if (!org) {
    return (
      <EmptyState
        title="Open a Salesforce org"
        description="Code coverage and Apex test runs use the selected Salesforce browser session."
      />
    );
  }

  const productionConfirmed =
    org.environment !== 'production' || productionText === 'RUN ALL TESTS';
  const canSubmit = acknowledged && productionConfirmed && !submitting;
  const testRunning = Boolean(
    testJobId && (!testProgress || !isTerminalTestStatus(testProgress.status)),
  );

  async function runAllTests() {
    if (!org || !canSubmit || testRunning) return;
    setSubmitting(true);
    setTestError(undefined);
    setTestFailures(undefined);
    setTestProgress(undefined);
    try {
      const submission = await sendMessage<ApexTestRunSubmission>({
        type: 'RUN_ALL_APEX_TESTS',
        payload: {
          key: org.key,
          requestId: crypto.randomUUID(),
          confirmedProduction: productionConfirmed,
        },
      });
      const jobId = submission?.jobId;
      if (!jobId) {
        throw new Error(
          'The updated background service is not active. Reload Varkole from chrome://extensions, refresh Salesforce, and try again.',
        );
      }
      setTestJobId(jobId);
      setShowConfirmation(false);
      setAcknowledged(false);
      setProductionText('');
    } catch (cause) {
      setTestError(
        cause instanceof Error ? cause.message : 'Salesforce could not start the Apex test run.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <div className="eyebrow">Apex tests · Tooling API</div>
          <h1>Code Coverage</h1>
        </div>
        <div className="coverage-actions">
          <button
            className="button button-secondary"
            type="button"
            disabled={testRunning || submitting}
            onClick={() => setShowConfirmation(true)}
          >
            {testRunning ? 'Tests running…' : 'Run All Tests'}
          </button>
          <button
            className="button button-primary"
            type="button"
            disabled={coverageLoading}
            onClick={() => void loadCoverage()}
          >
            {coverageLoading ? 'Loading…' : 'Refresh coverage'}
          </button>
        </div>
      </header>

      {showConfirmation && (
        <section
          className={`test-run-confirmation ${org.environment === 'production' ? 'production' : ''}`}
          aria-label="Confirm Apex test run"
        >
          <div>
            <strong>Run every Apex test?</strong>
            <p>
              Salesforce will run local and managed-package Apex tests asynchronously and collect
              new coverage. This can take several minutes and consumes test execution resources.
            </p>
          </div>
          <label className="confirmation-check">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
            />
            <span>I understand this starts an org-wide Apex test run.</span>
          </label>
          {org.environment === 'production' && (
            <label className="test-run-production-text">
              <span>Type RUN ALL TESTS</span>
              <input
                value={productionText}
                onChange={(event) => setProductionText(event.target.value)}
                autoComplete="off"
              />
            </label>
          )}
          <div className="test-run-confirmation-actions">
            <button
              className="button button-ghost"
              type="button"
              disabled={submitting}
              onClick={() => setShowConfirmation(false)}
            >
              Cancel
            </button>
            <button
              className="button button-primary"
              type="button"
              disabled={!canSubmit}
              onClick={() => void runAllTests()}
            >
              {submitting ? 'Starting…' : 'Start Apex tests'}
            </button>
          </div>
        </section>
      )}

      <InlineError message={testError} />
      {testJobId && (
        <TestRunStatus progress={testProgress} waiting={!testProgress} failures={testFailures} />
      )}

      <InlineError message={coverageError} />
      {coverage && (
        <>
          <CoverageSummary percentage={overallCoverage} />
          <QueryResults
            result={coverage}
            pageNumber={1}
            modeLabel="Tooling"
            loading={coverageLoading}
            columnLabels={COVERAGE_LABELS}
            expandTable
          />
        </>
      )}
    </div>
  );
}

function CoverageSummary({ percentage }: { percentage?: number | undefined }) {
  const display = percentage === undefined ? 'Unavailable' : `${percentage.toFixed(0)}%`;
  const status = percentage === undefined ? 'unknown' : percentage >= 75 ? 'passing' : 'below';

  return (
    <section className={`coverage-summary ${status}`} aria-label="Overall code coverage">
      <div>
        <span className="eyebrow">Overall org coverage</span>
        <strong>{display}</strong>
      </div>
      <div className="coverage-summary-detail">
        <span>Salesforce org-wide Apex coverage</span>
        {percentage !== undefined && (
          <div className="coverage-summary-track" aria-hidden="true">
            <span style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }} />
          </div>
        )}
        <small>
          {percentage === undefined
            ? 'Salesforce did not return an org-wide coverage value.'
            : percentage >= 75
              ? 'At or above the 75% deployment requirement.'
              : 'Below the 75% deployment requirement.'}
        </small>
      </div>
    </section>
  );
}

function TestRunStatus({
  progress,
  waiting,
  failures,
}: {
  progress?: ApexTestRunProgress | undefined;
  waiting: boolean;
  failures?: QueryPage | undefined;
}) {
  const total = progress?.methodsEnqueued ?? 0;
  const completed = progress?.methodsCompleted ?? 0;
  const percentage = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
  const terminal = progress ? isTerminalTestStatus(progress.status) : false;
  const unsuccessful = progress?.status === 'Failed' || progress?.status === 'Aborted';

  return (
    <>
      <section
        className={`test-run-status ${terminal ? 'complete' : ''} ${unsuccessful ? 'unsuccessful' : ''}`}
        aria-live="polite"
      >
        <div className="test-run-status-heading">
          <div>
            <span className="eyebrow">Latest Apex test run</span>
            <h2>{waiting ? 'Submitted to Salesforce' : progress?.status}</h2>
          </div>
          {progress && total > 0 && <strong>{percentage}%</strong>}
        </div>
        {!terminal && <div className="test-run-progress-bar" style={{ width: `${percentage}%` }} />}
        <div className="test-run-metrics">
          <span>
            <strong>{completed.toLocaleString()}</strong> completed
          </span>
          <span>
            <strong>{total.toLocaleString()}</strong> total
          </span>
          <span className={(progress?.methodsFailed ?? 0) > 0 ? 'failed' : ''}>
            <strong>{(progress?.methodsFailed ?? 0).toLocaleString()}</strong> failed
          </span>
          {progress?.testTimeMs !== undefined && (
            <span>
              <strong>{(progress.testTimeMs / 1_000).toFixed(2)}s</strong> test time
            </span>
          )}
        </div>
        {!terminal && <p>Varkole will refresh this status and code coverage automatically.</p>}
        {progress?.status === 'Completed' && progress.methodsFailed === 0 && (
          <p className="test-run-success">All completed Apex test methods passed.</p>
        )}
      </section>
      {failures && failures.records.length > 0 && (
        <div className="test-failures">
          <h2>Failed tests</h2>
          <QueryResults
            result={failures}
            pageNumber={1}
            modeLabel="Tooling"
            loading={false}
            columnLabels={FAILURE_LABELS}
          />
        </div>
      )}
    </>
  );
}

function runToolingQuery(org: OrgIdentity, soql: string): Promise<QueryPage> {
  return sendMessage<QueryPage>({
    type: 'RUN_QUERY',
    payload: {
      key: org.key,
      soql,
      mode: 'tooling',
      requestId: crypto.randomUUID(),
    },
  });
}
