import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AiAgentGuide } from './AiAgentGuide';

describe('AiAgentGuide', () => {
  it('explains that a record page is optional when no record context is available', () => {
    const html = renderToStaticMarkup(<AiAgentGuide />);

    expect(html).toContain('A record page is optional');
    expect(html).toContain('15- or 18-character Salesforce record ID');
    expect(html).toContain('this record');
  });

  it('explains automatic current-record grounding when a record is detected', () => {
    const html = renderToStaticMarkup(<AiAgentGuide currentRecordId="001000000000001AAA" />);

    expect(html).toContain('Current record detected');
    expect(html).toContain('the current record');
    expect(html).toContain('retrieve the fields your Salesforce user can access');
  });
});
