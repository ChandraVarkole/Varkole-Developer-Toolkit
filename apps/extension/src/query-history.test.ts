import { describe, expect, it } from 'vitest';
import { addQueryHistoryEntry, QUERY_HISTORY_LIMIT } from './query-history';

describe('addQueryHistoryEntry', () => {
  it('deduplicates identical queries per API mode and moves the latest run first', () => {
    const first = addQueryHistoryEntry([], {
      id: 'one',
      soql: ' SELECT Id FROM Account ',
      mode: 'rest',
      executedAt: '2026-11-04T10:00:00.000Z',
    });
    const next = addQueryHistoryEntry(first, {
      id: 'two',
      soql: 'SELECT Id FROM Account',
      mode: 'rest',
      executedAt: '2026-11-04T11:00:00.000Z',
    });

    expect(next).toHaveLength(1);
    expect(next[0]?.id).toBe('two');
  });

  it('keeps REST and Tooling runs separate and caps the history', () => {
    let history = addQueryHistoryEntry([], {
      id: 'rest',
      soql: 'SELECT Id FROM Account',
      mode: 'rest',
      executedAt: '2026-11-04T10:00:00.000Z',
    });
    history = addQueryHistoryEntry(history, {
      id: 'tooling',
      soql: 'SELECT Id FROM Account',
      mode: 'tooling',
      executedAt: '2026-11-04T10:01:00.000Z',
    });
    for (let index = 0; index < QUERY_HISTORY_LIMIT + 5; index += 1) {
      history = addQueryHistoryEntry(history, {
        id: String(index),
        soql: `SELECT Id FROM Account LIMIT ${index + 1}`,
        mode: 'rest',
        executedAt: new Date(index).toISOString(),
      });
    }

    expect(history).toHaveLength(QUERY_HISTORY_LIMIT);
    expect(history[0]?.id).toBe(String(QUERY_HISTORY_LIMIT + 4));
  });
});
