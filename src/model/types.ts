/**
 * Core data types for the spreadsheet model.
 *
 * The model is intentionally "dumb": it stores values and styles per cell and
 * knows nothing about formulas. Formula engines, validation, number formats and
 * the like are meant to be layered on top through the plugin API (see
 * `src/plugins/api.ts`). `CellData.meta` is a free-form bag that extensions can
 * use to keep their own per-cell state (e.g. a formula source string).
 */

export interface CellAddress {
  /** 0-based row index. */
  row: number;
  /** 0-based column index. */
  col: number;
}

/** A rectangular range. `start` is always the top-left and `end` the bottom-right corner. */
export interface CellRange {
  start: CellAddress;
  end: CellAddress;
}

export type CellValue = string | number | boolean | null;

export type HorizontalAlign = 'left' | 'center' | 'right';
export type VerticalAlign = 'top' | 'middle' | 'bottom';
export type BorderLineStyle = 'none' | 'thin' | 'medium' | 'thick' | 'dashed' | 'dotted' | 'double';

export interface BorderStyle {
  style: BorderLineStyle;
  /** CSS colour, e.g. `#000000`. */
  color: string;
}

/**
 * Visual style of a cell. All properties are optional; a missing property means
 * "inherit the sheet default". Font size is in points to match Excel.
 */
export interface CellStyle {
  fontFamily?: string;
  /** Font size in points (pt). */
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  /** Text colour (CSS colour). */
  color?: string;
  /** Fill colour (CSS colour). */
  backgroundColor?: string;
  hAlign?: HorizontalAlign;
  vAlign?: VerticalAlign;
  /** Wrap text inside the cell. */
  wrap?: boolean;
  borderTop?: BorderStyle;
  borderRight?: BorderStyle;
  borderBottom?: BorderStyle;
  borderLeft?: BorderStyle;
  /**
   * Reserved for extensions (e.g. an Excel-style number format such as `0.00%`).
   * The core does not interpret it, but it is preserved through copy/paste
   * with Excel via the `mso-number-format` CSS property.
   */
  numberFormat?: string;
}

export interface CellData {
  value: CellValue;
  style?: CellStyle;
  /** Free-form extension data. Never interpreted by the core. */
  meta?: Record<string, unknown>;
}

export type StyleKey = keyof CellStyle;

export const STYLE_KEYS: StyleKey[] = [
  'fontFamily',
  'fontSize',
  'bold',
  'italic',
  'underline',
  'strikethrough',
  'color',
  'backgroundColor',
  'hAlign',
  'vAlign',
  'wrap',
  'borderTop',
  'borderRight',
  'borderBottom',
  'borderLeft',
  'numberFormat',
];
