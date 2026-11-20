import type { QueryRecord } from '@varkole/shared';

export function mergeLoginUsernames(
  loginRecords: QueryRecord[],
  userRecords: QueryRecord[],
): QueryRecord[] {
  const usernames = new Map(
    userRecords.flatMap((record) =>
      typeof record.Id === 'string' && typeof record.Username === 'string'
        ? [[record.Id, record.Username] as const]
        : [],
    ),
  );
  return loginRecords.map((record) => formatLoginRecord(record, usernames));
}

function formatLoginRecord(record: QueryRecord, usernames: Map<string, string>): QueryRecord {
  const geo = record.LoginGeo;
  const values =
    geo && typeof geo === 'object'
      ? [
          (geo as Record<string, unknown>).City,
          (geo as Record<string, unknown>).Subdivision,
          (geo as Record<string, unknown>).Country,
        ]
          .filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))
          .join(', ')
      : typeof record.CountryIso === 'string'
        ? record.CountryIso
        : '';
  return {
    Username: typeof record.UserId === 'string' ? usernames.get(record.UserId) : undefined,
    LoginTime: record.LoginTime,
    SourceIp: record.SourceIp,
    LoginType: record.LoginType,
    LoginSubType: record.LoginSubType,
    Status: record.Status,
    Application: record.Application,
    LoginUrl: record.LoginUrl,
    Location: values,
  };
}
