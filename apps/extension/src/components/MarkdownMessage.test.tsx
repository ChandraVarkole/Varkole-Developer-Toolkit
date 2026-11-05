import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MarkdownMessage } from './MarkdownMessage';

describe('MarkdownMessage', () => {
  it('renders headings, emphasis, lists, and inline code', () => {
    const html = renderToStaticMarkup(
      <MarkdownMessage
        content={'## Users\n\n**19 users** were returned.\n\n1. Amanda\n2. Chandra\n\n`User`'}
      />,
    );

    expect(html).toContain('<h4>Users</h4>');
    expect(html).toContain('<strong>19 users</strong>');
    expect(html).toContain('<ol><li>Amanda</li><li>Chandra</li></ol>');
    expect(html).toContain('<code>User</code>');
  });

  it('escapes model-provided HTML instead of interpreting it', () => {
    const html = renderToStaticMarkup(<MarkdownMessage content={'<script>alert("x")</script>'} />);
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });
});
