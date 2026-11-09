import { describe, expect, it } from 'vitest';
import { buildExecutionLogQuery } from './apex-log';

describe('buildExecutionLogQuery', () => {
  it('targets the current user and Execute Anonymous logs created around the run', () => {
    const query = buildExecutionLogQuery('005000000000001AAA', Date.parse('2026-11-09T15:00:05Z'));

    expect(query).toContain("LogUserId = '005000000000001AAA'");
    expect(query).toContain("Operation = 'executeAnonymous'");
    expect(query).toContain('StartTime >= 2026-11-09T15:00:00.000Z');
    expect(query).toContain('ORDER BY StartTime DESC LIMIT 1');
  });

  it('rejects an unsafe user ID', () => {
    expect(() => buildExecutionLogQuery("005' OR Name != ''", Date.now())).toThrow(
      'invalid user ID',
    );
  });
});
