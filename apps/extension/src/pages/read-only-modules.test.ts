import { describe, expect, it } from 'vitest';
import { READ_ONLY_MODULES } from './read-only-modules';

describe('read-only module presentation', () => {
  it('always offers copy controls for Access Assignment assignees', () => {
    expect(READ_ONLY_MODULES.access?.copyableColumns).toEqual([
      'Assignee.Name',
      'Assignee.Username',
    ]);
  });
});
