import type {
  ApexTestRunSubmission,
  ExecuteAnonymousResult,
  QueryPage,
  QueryRecord,
} from '@varkole/shared';
import type { SalesforceTransport } from './transport';

interface RawQueryResponse {
  totalSize: number;
  done: boolean;
  records: QueryRecord[];
  nextRecordsUrl?: string;
}

export class SalesforceToolingClient {
  private readonly transport: SalesforceTransport;
  private readonly apiRoot: string;

  constructor(options: { transport: SalesforceTransport; apiVersion: string }) {
    this.transport = options.transport;
    this.apiRoot = `/services/data/v${options.apiVersion}/tooling`;
  }

  async query(soql: string, signal?: AbortSignal): Promise<QueryPage> {
    if (!soql.trim()) throw new Error('SOQL query cannot be empty.');
    const started = performance.now();
    const result = await this.transport.get<RawQueryResponse>(
      `${this.apiRoot}/query?q=${encodeURIComponent(soql)}`,
      signal,
    );
    return {
      ...result.data,
      ...(result.apiUsage ? { apiUsage: result.apiUsage } : {}),
      elapsedMs: Math.round(performance.now() - started),
    };
  }

  async queryNext(nextRecordsUrl: string, signal?: AbortSignal): Promise<QueryPage> {
    if (!nextRecordsUrl.includes('/tooling/query/')) {
      throw new Error('Tooling pagination requires a Tooling API query URL.');
    }
    const started = performance.now();
    const result = await this.transport.get<RawQueryResponse>(nextRecordsUrl, signal);
    return {
      ...result.data,
      ...(result.apiUsage ? { apiUsage: result.apiUsage } : {}),
      elapsedMs: Math.round(performance.now() - started),
    };
  }

  async executeAnonymous(apex: string, signal?: AbortSignal): Promise<ExecuteAnonymousResult> {
    if (!apex.trim()) throw new Error('Apex code cannot be empty.');
    const result = await this.transport.get<ExecuteAnonymousResult>(
      `${this.apiRoot}/executeAnonymous?anonymousBody=${encodeURIComponent(apex)}`,
      signal,
      { retry: false },
    );
    return result.data;
  }

  async runAllApexTests(signal?: AbortSignal): Promise<ApexTestRunSubmission> {
    const result = await this.transport.writeJson<string>(
      'POST',
      `${this.apiRoot}/runTestsAsynchronous/`,
      {
        testLevel: 'RunAllTestsInOrg',
        testCategories: ['Apex'],
        skipCodeCoverage: 'false',
      },
      signal,
    );
    if (!/^707[A-Za-z0-9]{12}(?:[A-Za-z0-9]{3})?$/.test(result.data)) {
      throw new Error('Salesforce did not return a valid asynchronous Apex test job ID.');
    }
    return { jobId: result.data };
  }

  async getApexLogBody(logId: string, signal?: AbortSignal): Promise<string> {
    if (!/^07L[A-Za-z0-9]{12}(?:[A-Za-z0-9]{3})?$/.test(logId)) {
      throw new Error('Enter a valid Salesforce Apex log ID.');
    }
    const result = await this.transport.getText(
      `${this.apiRoot}/sobjects/ApexLog/${encodeURIComponent(logId)}/Body`,
      signal,
    );
    return result.data;
  }
}
