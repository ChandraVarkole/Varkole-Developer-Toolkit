import { describe, expect, it } from 'vitest';
import { mergeLoginUsernames } from './users-logins';

describe('login history formatting', () => {
  it('resolves usernames locally from LoginHistory UserId values', () => {
    const records = mergeLoginUsernames(
      [
        {
          UserId: '005000000000001',
          LoginTime: '2026-11-19T12:00:00.000Z',
          LoginGeo: { City: 'Tempe', Subdivision: 'Arizona', Country: 'United States' },
        },
      ],
      [{ Id: '005000000000001', Username: 'developer@example.com' }],
    );

    expect(records).toEqual([
      {
        Username: 'developer@example.com',
        LoginTime: '2026-11-19T12:00:00.000Z',
        SourceIp: undefined,
        LoginType: undefined,
        LoginSubType: undefined,
        Status: undefined,
        Application: undefined,
        LoginUrl: undefined,
        Location: 'Tempe, Arizona, United States',
      },
    ]);
  });
});
