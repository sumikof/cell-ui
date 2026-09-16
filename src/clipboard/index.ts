import type { SheetModel } from '../model/sheet';
import type { CellData, CellRange } from '../model/types';
import { normalizeRange, rangeSize } from '../model/address';
import { formatValue } from '../model/value';
import { serializeTsv, parseTsv } from './tsv';
import { serializeHtml, parseHtmlTable, htmlHasTable } from './html';

export * from './tsv';
export * from './html';

export interface ClipboardPayload {
  /** `text/plain` – Excel TSV dialect. */
  text: string;
  /** `text/html` – table with inline styles. */
  html: string;
  /** The raw cells (including `meta`) for in-app pastes. */
  block: CellData[][];
  range: CellRange;
}

export interface ParsedClipboard {
  block: CellData[][];
  columnWidths?: (number | undefined)[];
  rowHeights?: (number | undefined)[];
  /** True when the data came from this application's own last copy (meta preserved). */
  internal: boolean;
  /** True when the block came from plain text: values are raw strings to be parsed at paste time. */
  plainText?: boolean;
}

export interface ClipboardDataLike {
  html?: string | null;
  text?: string | null;
}

/** Build the clipboard payload for a range of the sheet. */
export function buildClipboardPayload(
  model: SheetModel,
  range: CellRange,
  displayText: (cell: CellData, row: number, col: number) => string = (cell) => formatValue(cell.value),
): ClipboardPayload {
  const r = normalizeRange(range);
  const block = model.getCells(r);
  const textRows = block.map((row, ri) => row.map((cell, ci) => displayText(cell, r.start.row + ri, r.start.col + ci)));
  const { rows, cols } = rangeSize(r);
  const columnWidths = Array.from({ length: cols }, (_, i) => model.getColumnWidth(r.start.col + i));
  const rowHeights = Array.from({ length: rows }, (_, i) => model.getRowHeight(r.start.row + i));
  return {
    text: serializeTsv(textRows),
    html: serializeHtml(block, {
      columnWidths,
      rowHeights,
      displayText: (cell, ri, ci) => displayText(cell, r.start.row + ri, r.start.col + ci),
    }),
    block,
    range: r,
  };
}

/**
 * Keeps track of the last copy made by this instance so that in-app pastes can
 * carry `meta` (and exact values) instead of round-tripping through text.
 */
export class ClipboardState {
  private last: ClipboardPayload | null = null;
  /** Range that was cut and is waiting to be pasted (shown with a marquee). */
  cutRange: CellRange | null = null;

  remember(payload: ClipboardPayload, cut: boolean): void {
    this.last = payload;
    this.cutRange = cut ? payload.range : null;
  }

  clearCut(): void {
    this.cutRange = null;
  }

  get lastPayload(): ClipboardPayload | null {
    return this.last;
  }

  /**
   * Parse clipboard data into a block of cells. Prefers the in-app payload when
   * the plain text matches (same copy), then HTML tables, then TSV text.
   */
  parse(data: ClipboardDataLike, options: { valuesOnly?: boolean } = {}): ParsedClipboard | null {
    const html = data.html ?? '';
    const text = data.text ?? '';
    if (this.last && text && normalizeNewlines(text) === normalizeNewlines(this.last.text) && (!html || html === this.last.html || !htmlHasTable(html) || /name="Generator" content="cell-ui"/.test(html))) {
      const block = this.last.block.map((row) => row.map((c) => cloneForPaste(c, options.valuesOnly)));
      return { block, internal: true };
    }
    if (html && htmlHasTable(html)) {
      const parsed = parseHtmlTable(html);
      if (parsed) {
        return {
          block: parsed.cells.map((row) => row.map((c) => cloneForPaste(c, options.valuesOnly))),
          columnWidths: parsed.columnWidths,
          rowHeights: parsed.rowHeights,
          internal: false,
        };
      }
    }
    if (text !== '') {
      const rows = parseTsv(text);
      return { block: rows.map((row) => row.map((t) => ({ value: t }))), internal: false, plainText: true };
    }
    return null;
  }
}

function normalizeNewlines(s: string): string {
  return s.replace(/\r\n/g, '\n').replace(/\n+$/, '');
}

function cloneForPaste(cell: CellData, valuesOnly?: boolean): CellData {
  if (valuesOnly) return { value: cell.value };
  return {
    value: cell.value,
    style: cell.style ? { ...cell.style } : undefined,
    meta: cell.meta ? { ...cell.meta } : undefined,
  };
}

/**
 * Excel paste semantics: the block is pasted at the selection's top-left. When
 * the selection is larger than the block and its dimensions are multiples of
 * the block's, the block is tiled to fill the selection.
 */
export function computePasteRange(selection: CellRange, blockRows: number, blockCols: number): CellRange {
  const sel = normalizeRange(selection);
  const { rows, cols } = rangeSize(sel);
  const tileRows = rows > blockRows && rows % blockRows === 0 ? rows : blockRows;
  const tileCols = cols > blockCols && cols % blockCols === 0 ? cols : blockCols;
  return {
    start: { ...sel.start },
    end: { row: sel.start.row + tileRows - 1, col: sel.start.col + tileCols - 1 },
  };
}

/** Expand a block to fill the target range by tiling. */
export function tileBlock(block: CellData[][], target: CellRange): CellData[][] {
  const { rows, cols } = rangeSize(target);
  const br = block.length;
  const bc = Math.max(1, ...block.map((r) => r.length));
  const out: CellData[][] = [];
  for (let r = 0; r < rows; r++) {
    const line: CellData[] = [];
    for (let c = 0; c < cols; c++) {
      const src = block[r % br]?.[c % bc] ?? { value: null };
      line.push({ value: src.value, style: src.style ? { ...src.style } : undefined, meta: src.meta ? { ...src.meta } : undefined });
    }
    out.push(line);
  }
  return out;
}
