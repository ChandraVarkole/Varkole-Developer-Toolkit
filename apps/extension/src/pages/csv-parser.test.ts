import { describe, expect, it } from 'vitest';
import { parseCsv } from './csv-parser';

describe('parseCsv', () => {
  it('parses quoted commas, quotes and newlines', () => {
    expect(parseCsv('Name,Notes\r\n"Acme, Inc.","Line 1\nLine ""2"""')).toEqual({
      headers: ['Name', 'Notes'],
      rows: [{ Name: 'Acme, Inc.', Notes: 'Line 1\nLine "2"' }],
    });
  });

  it('rejects duplicate headers and uneven rows', () => {
    expect(() => parseCsv('Name,Name\nA,B')).toThrow('unique');
    expect(() => parseCsv('Name,Phone\nAcme')).toThrow('expected 2');
  });
});
