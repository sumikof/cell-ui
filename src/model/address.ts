import type { CellAddress, CellRange } from './types';

/** Convert a 0-based column index to an Excel-style column label (0 -> A, 25 -> Z, 26 -> AA). */
export function columnLabel(col: number): string {
  let n = col + 1;
  let label = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
}

/** Convert an Excel-style column label back to a 0-based index. Returns -1 when invalid. */
export function columnIndex(label: string): number {
  const s = label.toUpperCase();
  if (!/^[A-Z]+$/.test(s)) return -1;
  let n = 0;
  for (let i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64);
  return n - 1;
}

/** A1-style reference for an address (row 0, col 0 -> "A1"). */
export function addressToA1(addr: CellAddress): string {
  return `${columnLabel(addr.col)}${addr.row + 1}`;
}

/** Parse an A1-style reference. Returns null when the text is not a valid reference. */
export function a1ToAddress(ref: string): CellAddress | null {
  const m = /^\s*\$?([A-Za-z]{1,3})\$?(\d+)\s*$/.exec(ref);
  if (!m) return null;
  const col = columnIndex(m[1]);
  const row = parseInt(m[2], 10) - 1;
  if (col < 0 || row < 0) return null;
  return { row, col };
}

/** "A1:C3" -> range. A single reference such as "B2" yields a 1x1 range. */
export function a1ToRange(ref: string): CellRange | null {
  const parts = ref.split(':');
  if (parts.length === 1) {
    const a = a1ToAddress(parts[0]);
    return a ? { start: a, end: { ...a } } : null;
  }
  if (parts.length !== 2) return null;
  const a = a1ToAddress(parts[0]);
  const b = a1ToAddress(parts[1]);
  if (!a || !b) return null;
  return normalizeRange({ start: a, end: b });
}

export function rangeToA1(range: CellRange): string {
  const r = normalizeRange(range);
  const a = addressToA1(r.start);
  const b = addressToA1(r.end);
  return a === b ? a : `${a}:${b}`;
}

export function cellKey(row: number, col: number): string {
  return `${row},${col}`;
}

export function parseCellKey(key: string): CellAddress {
  const [r, c] = key.split(',');
  return { row: Number(r), col: Number(c) };
}

export function sameAddress(a: CellAddress, b: CellAddress): boolean {
  return a.row === b.row && a.col === b.col;
}

/** Return a copy of the range with start at the top-left and end at the bottom-right. */
export function normalizeRange(range: CellRange): CellRange {
  return {
    start: {
      row: Math.min(range.start.row, range.end.row),
      col: Math.min(range.start.col, range.end.col),
    },
    end: {
      row: Math.max(range.start.row, range.end.row),
      col: Math.max(range.start.col, range.end.col),
    },
  };
}

export function rangeFromAddress(addr: CellAddress): CellRange {
  return { start: { ...addr }, end: { ...addr } };
}

export function rangeContains(range: CellRange, addr: CellAddress): boolean {
  const r = normalizeRange(range);
  return addr.row >= r.start.row && addr.row <= r.end.row && addr.col >= r.start.col && addr.col <= r.end.col;
}

export function rangeSize(range: CellRange): { rows: number; cols: number } {
  const r = normalizeRange(range);
  return { rows: r.end.row - r.start.row + 1, cols: r.end.col - r.start.col + 1 };
}

export function sameRange(a: CellRange, b: CellRange): boolean {
  const x = normalizeRange(a);
  const y = normalizeRange(b);
  return sameAddress(x.start, y.start) && sameAddress(x.end, y.end);
}

/** Iterate over every address in a range, row by row. */
export function* iterateRange(range: CellRange): Generator<CellAddress> {
  const r = normalizeRange(range);
  for (let row = r.start.row; row <= r.end.row; row++) {
    for (let col = r.start.col; col <= r.end.col; col++) {
      yield { row, col };
    }
  }
}

export function clampAddress(addr: CellAddress, rows: number, cols: number): CellAddress {
  return {
    row: Math.max(0, Math.min(rows - 1, addr.row)),
    col: Math.max(0, Math.min(cols - 1, addr.col)),
  };
}
