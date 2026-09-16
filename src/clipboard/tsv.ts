/**
 * Tab-separated values in the dialect Excel uses for `text/plain` clipboard
 * data: cells separated by TAB, rows by CRLF; a cell containing TAB, a line
 * break or a double quote is wrapped in double quotes with inner quotes doubled.
 */

export function tsvEscape(text: string): string {
  if (/[\t\r\n"]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function serializeTsv(rows: string[][]): string {
  return rows.map((r) => r.map(tsvEscape).join('\t')).join('\r\n') + '\r\n';
}

/** Parse TSV text into a 2D string array. Handles quoted multi-line cells. */
export function parseTsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let i = 0;
  let inQuotes = false;
  let fieldStarted = false;
  const n = text.length;
  while (i < n) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"' && !fieldStarted) {
      inQuotes = true;
      fieldStarted = true;
      i++;
      continue;
    }
    if (ch === '\t') {
      row.push(field);
      field = '';
      fieldStarted = false;
      i++;
      continue;
    }
    if (ch === '\r' || ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      fieldStarted = false;
      if (ch === '\r' && text[i + 1] === '\n') i += 2;
      else i++;
      continue;
    }
    field += ch;
    fieldStarted = true;
    i++;
  }
  // Trailing content without a final newline.
  if (field !== '' || row.length > 0 || rows.length === 0) {
    row.push(field);
    rows.push(row);
  }
  // Excel terminates the data with CRLF, which would produce a spurious empty last row.
  if (rows.length > 1 && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') rows.pop();
  const width = Math.max(1, ...rows.map((r) => r.length));
  return rows.map((r) => (r.length < width ? [...r, ...Array(width - r.length).fill('')] : r));
}
