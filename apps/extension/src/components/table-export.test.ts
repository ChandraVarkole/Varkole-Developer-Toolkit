import { describe, expect, it } from 'vitest';
import { exportTableRows, tableDelimitedText } from './table-export';

describe('table exports', () => {
  const rows = [{ User: { Username: 'ada@example.com' }, Note: 'Hello, "world"' }];

  it('flattens selected nested columns for JSON', () => {
    expect(exportTableRows(rows, ['User.Username', 'Note'])).toEqual([
      { 'User.Username': 'ada@example.com', Note: 'Hello, "world"' },
    ]);
  });

  it('creates escaped CSV with display labels', () => {
    expect(
      tableDelimitedText(rows, ['User.Username', 'Note'], { 'User.Username': 'Username' }),
    ).toBe('Username,Note\nada@example.com,"Hello, ""world"""');
  });
});
