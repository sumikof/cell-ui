import { describe, it, expect } from 'vitest';
import { parseTsv, serializeTsv } from '../src/clipboard/tsv';

describe('TSV (Excel text/plain dialect)', () => {
  it('serialises with CRLF and quotes special cells', () => {
    expect(serializeTsv([['a', 'b'], ['c', 'd']])).toBe('a\tb\r\nc\td\r\n');
    expect(serializeTsv([['line1\nline2', 'say "hi"', 'tab\there']])).toBe('"line1\nline2"\t"say ""hi"""\t"tab\there"\r\n');
  });

  it('parses Excel output including quoted multi-line cells', () => {
    expect(parseTsv('a\tb\r\nc\td\r\n')).toEqual([['a', 'b'], ['c', 'd']]);
    expect(parseTsv('"line1\r\nline2"\t"say ""hi"""\r\n')).toEqual([['line1\r\nline2', 'say "hi"']]);
    expect(parseTsv('x')).toEqual([['x']]);
    expect(parseTsv('1\n2\n')).toEqual([['1'], ['2']]);
  });

  it('pads ragged rows', () => {
    expect(parseTsv('a\tb\tc\nd\n')).toEqual([['a', 'b', 'c'], ['d', '', '']]);
  });

  it('round-trips', () => {
    const rows = [['1', 'two\nlines'], ['"quoted"', '']];
    expect(parseTsv(serializeTsv(rows))).toEqual(rows);
  });
});
