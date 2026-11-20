import { describe, expect, it } from 'vitest';
import { ACCESS_ASSIGNMENT_COPYABLE_COLUMNS } from './access-assignments-config';

describe('read-only module presentation', () => {
  it('always offers copy controls for Access Assignment assignees', () => {
    expect(ACCESS_ASSIGNMENT_COPYABLE_COLUMNS).toEqual(['Assignee.Name', 'Assignee.Username']);
  });
});
