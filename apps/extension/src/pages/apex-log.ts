export function buildExecutionLogQuery(userId: string, startedAt: number): string {
  if (!/^005[a-zA-Z0-9]{12,15}$/.test(userId)) {
    throw new Error('Salesforce returned an invalid user ID for the debug-log lookup.');
  }
  const after = new Date(startedAt - 5_000).toISOString();
  return (
    `SELECT Id, StartTime, Operation, Status, LogLength, DurationMilliseconds ` +
    `FROM ApexLog WHERE LogUserId = '${userId}' AND Operation = 'executeAnonymous' ` +
    `AND StartTime >= ${after} ORDER BY StartTime DESC LIMIT 1`
  );
}
