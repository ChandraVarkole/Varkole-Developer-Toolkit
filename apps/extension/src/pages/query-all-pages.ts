import type { ApiMode, QueryPage, QueryRecord } from '@varkole/shared';
import { sendMessage } from '../api';

export const ALL_QUERY_ROW_LIMIT = 50_000;

export async function loadAllQueryPages(input: {
  key: string;
  soql: string;
  mode: ApiMode;
  rowLimit?: number;
}): Promise<QueryPage> {
  const startedAt = performance.now();
  const rowLimit = input.rowLimit ?? ALL_QUERY_ROW_LIMIT;
  const records: QueryRecord[] = [];
  let page = await sendMessage<QueryPage>({
    type: 'RUN_QUERY',
    payload: {
      key: input.key,
      soql: input.soql,
      mode: input.mode,
      requestId: crypto.randomUUID(),
    },
  });
  let apiUsage = page.apiUsage;
  const totalSize = page.totalSize;
  records.push(...page.records.slice(0, rowLimit));

  while (page.nextRecordsUrl && records.length < rowLimit) {
    page = await sendMessage<QueryPage>({
      type: 'QUERY_NEXT',
      payload: {
        key: input.key,
        nextRecordsUrl: page.nextRecordsUrl,
        requestId: crypto.randomUUID(),
        mode: input.mode,
      },
    });
    apiUsage = page.apiUsage ?? apiUsage;
    records.push(...page.records.slice(0, rowLimit - records.length));
  }

  return {
    totalSize,
    done: !page.nextRecordsUrl,
    records,
    ...(page.nextRecordsUrl ? { nextRecordsUrl: page.nextRecordsUrl } : {}),
    ...(apiUsage ? { apiUsage } : {}),
    elapsedMs: Math.round(performance.now() - startedAt),
  };
}
