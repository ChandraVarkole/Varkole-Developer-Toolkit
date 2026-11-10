import { Fragment, type ReactNode } from 'react';

export function MarkdownMessage({
  content,
  allowedOrigin,
}: {
  content: string;
  allowedOrigin?: string;
}) {
  return <div className="ai-markdown">{renderBlocks(content, allowedOrigin)}</div>;
}

function renderBlocks(content: string, allowedOrigin?: string): ReactNode[] {
  const lines = content.replace(/\r\n?/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? '';
    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.trimStart().startsWith('```')) {
      const language = line.trim().slice(3).trim();
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !(lines[index] ?? '').trimStart().startsWith('```')) {
        code.push(lines[index] ?? '');
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push(
        <pre key={`code-${index}`}>
          <code className={language ? `language-${language}` : undefined}>{code.join('\n')}</code>
        </pre>,
      );
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const level = heading[1]?.length ?? 1;
      const text = heading[2] ?? '';
      const Heading = level === 1 ? 'h3' : level === 2 ? 'h4' : 'h5';
      blocks.push(<Heading key={`heading-${index}`}>{renderInline(text, allowedOrigin)}</Heading>);
      index += 1;
      continue;
    }

    const unordered = line.match(/^\s*[-*]\s+(.+)$/);
    if (unordered) {
      const items: string[] = [];
      while (index < lines.length) {
        const item = (lines[index] ?? '').match(/^\s*[-*]\s+(.+)$/);
        if (!item) break;
        items.push(item[1] ?? '');
        index += 1;
      }
      blocks.push(
        <ul key={`list-${index}`}>
          {items.map((item, itemIndex) => (
            <li key={`${item}-${itemIndex}`}>{renderInline(item, allowedOrigin)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (ordered) {
      const items: string[] = [];
      while (index < lines.length) {
        const item = (lines[index] ?? '').match(/^\s*\d+[.)]\s+(.+)$/);
        if (!item) break;
        items.push(item[1] ?? '');
        index += 1;
      }
      blocks.push(
        <ol key={`ordered-${index}`}>
          {items.map((item, itemIndex) => (
            <li key={`${item}-${itemIndex}`}>{renderInline(item, allowedOrigin)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    if (isTableHeader(lines, index)) {
      const headers = tableCells(lines[index] ?? '');
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && /^\s*\|.*\|\s*$/.test(lines[index] ?? '')) {
        rows.push(tableCells(lines[index] ?? ''));
        index += 1;
      }
      blocks.push(
        <div className="ai-markdown-table" key={`table-${index}`}>
          <table>
            <thead>
              <tr>
                {headers.map((header, cellIndex) => (
                  <th key={`${header}-${cellIndex}`}>{renderInline(header, allowedOrigin)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={`row-${rowIndex}`}>
                  {headers.map((_, cellIndex) => (
                    <td key={`cell-${rowIndex}-${cellIndex}`}>
                      {renderInline(row[cellIndex] ?? '', allowedOrigin)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    const paragraph: string[] = [line.trim()];
    index += 1;
    while (index < lines.length && !isBlockStart(lines[index] ?? '')) {
      paragraph.push((lines[index] ?? '').trim());
      index += 1;
    }
    blocks.push(
      <p key={`paragraph-${index}`}>{renderInline(paragraph.join(' '), allowedOrigin)}</p>,
    );
  }

  return blocks;
}

function isBlockStart(line: string): boolean {
  return (
    !line.trim() ||
    /^#{1,3}\s+/.test(line) ||
    /^\s*[-*]\s+/.test(line) ||
    /^\s*\d+[.)]\s+/.test(line) ||
    /^\s*\|.*\|\s*$/.test(line) ||
    line.trimStart().startsWith('```')
  );
}

function renderInline(value: string, allowedOrigin?: string): ReactNode[] {
  return value
    .split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+]\(https:\/\/[^)\s]+\))/g)
    .filter(Boolean)
    .map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={`strong-${index}`}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={`inline-code-${index}`}>{part.slice(1, -1)}</code>;
      }
      const link = part.match(/^\[([^\]]+)]\((https:\/\/[^)\s]+)\)$/);
      if (link && isSafeSalesforceLink(link[2] ?? '', allowedOrigin)) {
        return (
          <a key={`link-${index}`} href={link[2]} target="_blank" rel="noreferrer">
            {link[1]}
          </a>
        );
      }
      return <Fragment key={`text-${index}`}>{part}</Fragment>;
    });
}

function isTableHeader(lines: string[], index: number): boolean {
  return (
    /^\s*\|.*\|\s*$/.test(lines[index] ?? '') &&
    /^\s*\|(?:\s*:?-{3,}:?\s*\|)+\s*$/.test(lines[index + 1] ?? '')
  );
}

function tableCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((cell) => cell.trim());
}

function isSafeSalesforceLink(value: string, allowedOrigin?: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;
    if (allowedOrigin && url.origin === allowedOrigin) return true;
    return ['developer.salesforce.com', 'help.salesforce.com', 'trailhead.salesforce.com'].includes(
      url.hostname,
    );
  } catch {
    return false;
  }
}
