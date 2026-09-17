import type { CellAddress, CellRange, CellValue } from './types';
import { normalizeRange } from './address';

/**
 * Data validation rules (Excel's "Data Validation"). The core ships two
 * rule types; applications can register more through
 * `Spreadsheet.registerValidator`.
 */
export interface ValidationRuleBase {
  type: string;
  /** Accept empty cells (default true). */
  allowBlank?: boolean;
  /** Custom error message shown instead of the built-in one. */
  message?: string;
}

/** Only numbers, optionally within [min, max] and/or integers. */
export interface NumberValidationRule extends ValidationRuleBase {
  type: 'number';
  min?: number;
  max?: number;
  integer?: boolean;
}

/** Only values from a list. A dropdown is offered on the cell. */
export interface ListValidationRule extends ValidationRuleBase {
  type: 'list';
  options: (string | number)[];
  /** Allow typing values that are not in the list (default false). */
  allowOther?: boolean;
  /** Show the in-cell dropdown (default true). */
  dropdown?: boolean;
}

export type ValidationRule = NumberValidationRule | ListValidationRule | (ValidationRuleBase & Record<string, unknown>);

export interface ValidationEntry {
  range: CellRange;
  rule: ValidationRule;
}

/** Marker for "every row" / "every column" in a validation range. */
export const TO_END = Number.MAX_SAFE_INTEGER;

/** Range covering a whole column (all rows). */
export function columnRange(col: number, toCol: number = col): CellRange {
  return { start: { row: 0, col: Math.min(col, toCol) }, end: { row: TO_END, col: Math.max(col, toCol) } };
}

/** Range covering a whole row (all columns). */
export function rowRange(row: number, toRow: number = row): CellRange {
  return { start: { row: Math.min(row, toRow), col: 0 }, end: { row: Math.max(row, toRow), col: TO_END } };
}

export function entryContains(entry: ValidationEntry, addr: CellAddress): boolean {
  const r = entry.range;
  return addr.row >= r.start.row && addr.row <= r.end.row && addr.col >= r.start.col && addr.col <= r.end.col;
}

/** Remove `range` from the coverage of `entries` (splitting entries that overlap it). */
export function subtractRange(entries: ValidationEntry[], range: CellRange): ValidationEntry[] {
  const cut = normalizeRange(range);
  const out: ValidationEntry[] = [];
  for (const e of entries) {
    const r = e.range;
    const overlaps = !(cut.end.row < r.start.row || cut.start.row > r.end.row || cut.end.col < r.start.col || cut.start.col > r.end.col);
    if (!overlaps) {
      out.push(e);
      continue;
    }
    // Up to four remaining pieces: above, below, left, right.
    if (r.start.row < cut.start.row) out.push({ rule: e.rule, range: { start: { ...r.start }, end: { row: cut.start.row - 1, col: r.end.col } } });
    if (r.end.row > cut.end.row) out.push({ rule: e.rule, range: { start: { row: cut.end.row + 1, col: r.start.col }, end: { ...r.end } } });
    const midTop = Math.max(r.start.row, cut.start.row);
    const midBottom = Math.min(r.end.row, cut.end.row);
    if (r.start.col < cut.start.col) out.push({ rule: e.rule, range: { start: { row: midTop, col: r.start.col }, end: { row: midBottom, col: cut.start.col - 1 } } });
    if (r.end.col > cut.end.col) out.push({ rule: e.rule, range: { start: { row: midTop, col: cut.end.col + 1 }, end: { row: midBottom, col: r.end.col } } });
  }
  return out;
}

/** Shift validation ranges after inserting (delta > 0) or deleting (delta < 0) rows/columns at `at`. */
export function shiftEntries(entries: ValidationEntry[], axis: 'row' | 'col', at: number, delta: number): ValidationEntry[] {
  const out: ValidationEntry[] = [];
  const removedEnd = delta < 0 ? at - delta - 1 : at - 1; // inclusive
  for (const e of entries) {
    const s = { ...e.range.start };
    const en = { ...e.range.end };
    const key = axis;
    let start = s[key];
    let end = en[key];
    if (delta > 0) {
      if (start >= at) start = Math.min(TO_END, start + delta);
      if (end >= at && end !== TO_END) end += delta;
    } else {
      // Deleting [at, removedEnd]
      if (end < at) {
        // untouched
      } else if (start > removedEnd) {
        start += delta;
        if (end !== TO_END) end += delta;
      } else {
        // overlap: clip
        const newStart = start < at ? start : at;
        let newEnd = end > removedEnd ? (end === TO_END ? TO_END : end + delta) : at - 1;
        if (newEnd < newStart) continue; // fully deleted
        start = newStart;
        end = newEnd;
        if (end < 0) continue;
        newEnd = end;
      }
    }
    s[key] = start;
    en[key] = end;
    out.push({ rule: e.rule, range: { start: s, end: en } });
  }
  return out;
}

export interface ValidationStrings {
  blankNotAllowed: string;
  invalidNumber: string;
  invalidInteger: string;
  numberMin: string;
  numberMax: string;
  numberBetween: string;
  invalidList: string;
}

/** Validate a value against a built-in rule. Returns an error message or null when valid. */
export function validateBuiltin(rule: ValidationRule, value: CellValue, strings: ValidationStrings): string | null {
  const blank = value === null || value === undefined || value === '';
  if (blank) return rule.allowBlank === false ? rule.message ?? strings.blankNotAllowed : null;
  switch (rule.type) {
    case 'number': {
      const r = rule as NumberValidationRule;
      const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
      if (!Number.isFinite(n)) return r.message ?? strings.invalidNumber;
      if (r.integer && !Number.isInteger(n)) return r.message ?? strings.invalidInteger;
      const hasMin = typeof r.min === 'number';
      const hasMax = typeof r.max === 'number';
      if (hasMin && hasMax && (n < r.min! || n > r.max!)) return r.message ?? strings.numberBetween.replace('{min}', String(r.min)).replace('{max}', String(r.max));
      if (hasMin && n < r.min!) return r.message ?? strings.numberMin.replace('{min}', String(r.min));
      if (hasMax && n > r.max!) return r.message ?? strings.numberMax.replace('{max}', String(r.max));
      return null;
    }
    case 'list': {
      const r = rule as ListValidationRule;
      if (r.allowOther) return null;
      const text = String(value);
      const ok = r.options.some((o) => o === value || String(o) === text);
      return ok ? null : r.message ?? strings.invalidList.replace('{options}', r.options.map(String).join(', '));
    }
    default:
      return null;
  }
}
