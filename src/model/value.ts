import type { CellData, CellValue, HorizontalAlign } from './types';

const NUMBER_RE = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/;

/**
 * Convert text typed by the user (or pasted as plain text) into a cell value,
 * following Excel's "General" conventions:
 *  - numbers become numbers, TRUE/FALSE become booleans
 *  - a leading apostrophe forces text (and is stripped)
 *  - everything else is kept as a string
 * Formulas (`=...`) are deliberately treated as plain text by the core; a
 * formula plugin can register its own `valueParser` to intercept them.
 */
export function parseInputValue(text: string): CellValue {
  if (text === '' || text === null || text === undefined) return null;
  if (text.startsWith("'")) return text.slice(1);
  const trimmed = text.trim();
  if (NUMBER_RE.test(trimmed)) {
    const n = Number(trimmed);
    if (Number.isFinite(n)) return n;
  }
  const upper = trimmed.toUpperCase();
  if (upper === 'TRUE') return true;
  if (upper === 'FALSE') return false;
  return text;
}

/** Format a number like Excel's General format (up to ~11 significant digits). */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  if (Number.isInteger(n) && Math.abs(n) < 1e15) return String(n);
  const s = parseFloat(n.toPrecision(11)).toString();
  return s;
}

/** Text shown in the cell for a value. */
export function formatValue(value: CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return formatNumber(value);
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  return String(value);
}

/** Text shown in the editor / formula bar. Strings that look like numbers are escaped with a quote. */
export function editableText(cell: CellData | undefined): string {
  if (!cell || cell.value === null || cell.value === undefined) return '';
  const v = cell.value;
  if (typeof v === 'string') {
    if (v !== '' && (NUMBER_RE.test(v.trim()) || ['TRUE', 'FALSE'].includes(v.trim().toUpperCase()) || v.startsWith("'"))) {
      return `'${v}`;
    }
    return v;
  }
  return formatValue(v);
}

/** Default horizontal alignment for a value when the style does not specify one (numbers right, booleans centre). */
export function defaultAlign(value: CellValue): HorizontalAlign {
  if (typeof value === 'number') return 'right';
  if (typeof value === 'boolean') return 'center';
  return 'left';
}
