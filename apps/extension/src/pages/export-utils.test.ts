import { describe, expect, it } from 'vitest';
import { recordsToCsv, recordsToJson } from './export-utils';

describe('export utilities', () => {
  it('flattens relationships and escapes CSV values', () => {
    const csv = recordsToCsv([
      { attributes: { type: 'Account' }, Id: '001xx', Name: 'Acme, Inc.', Owner: { Name: 'Ada' } },
    ]);
    expect(csv).toContain('"Id","Name","Owner.Name"');
    expect(csv).toContain('"001xx","Acme, Inc.","Ada"');
  });

  it('neutralizes spreadsheet formulas', () => {
    expect(recordsToCsv([{ Name: '=HYPERLINK("bad")' }])).toContain('"\'=HYPERLINK(""bad"")"');
  });

  it('omits Salesforce attributes from JSON', () => {
    expect(recordsToJson([{ attributes: { type: 'Account' }, Id: '001xx' }])).toBe(
      '[\n  {\n    "Id": "001xx"\n  }\n]',
    );
  });
});
