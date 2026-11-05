export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

export function parseCsv(input: string): ParsedCsv {
  const matrix: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]!;
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"' && cell.length === 0) {
      quoted = true;
    } else if (character === ',') {
      row.push(cell);
      cell = '';
    } else if (character === '\n') {
      row.push(cell.replace(/\r$/, ''));
      matrix.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }

  if (quoted) throw new Error('CSV contains an unclosed quoted value.');
  if (cell.length || row.length) {
    row.push(cell.replace(/\r$/, ''));
    matrix.push(row);
  }
  const nonEmpty = matrix.filter((values) => values.some((value) => value.trim()));
  const headers = nonEmpty[0]?.map((header) => header.trim()) ?? [];
  if (!headers.length || headers.some((header) => !header)) {
    throw new Error('CSV must contain a non-empty header row.');
  }
  if (new Set(headers).size !== headers.length) throw new Error('CSV headers must be unique.');

  const rows = nonEmpty.slice(1).map((values, rowIndex) => {
    if (values.length !== headers.length) {
      throw new Error(
        `CSV row ${rowIndex + 2} has ${values.length} values; expected ${headers.length}.`,
      );
    }
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
  return { headers, rows };
}
