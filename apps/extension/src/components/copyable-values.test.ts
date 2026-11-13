import { describe, expect, it } from 'vitest';
import { isCopyableTechnicalValue } from './copyable-values';

describe('copyable technical table values', () => {
  it('offers copy for usernames, IDs, API names, URLs, and JSON', () => {
    expect(isCopyableTechnicalValue('Assignee.Username', 'user@example.test')).toBe(true);
    expect(isCopyableTechnicalValue('RecordId', '001000000000001AAA')).toBe(true);
    expect(isCopyableTechnicalValue('ApiName', 'Account_Status__c')).toBe(true);
    expect(isCopyableTechnicalValue('Config', '{"enabled":true}')).toBe(true);
    expect(
      isCopyableTechnicalValue(
        'Assignee.Name',
        '{"attributes":{"type":"User"},"Name":"Sample User"}',
      ),
    ).toBe(true);
  });

  it('does not add copy controls to ordinary names or emails', () => {
    expect(isCopyableTechnicalValue('Name', 'Sample Account')).toBe(false);
    expect(isCopyableTechnicalValue('Email', 'user@example.test')).toBe(false);
  });
});
