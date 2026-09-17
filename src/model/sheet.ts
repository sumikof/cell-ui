import { Emitter } from './emitter';
import { cellKey, iterateRange, normalizeRange, parseCellKey } from './address';
import type { CellAddress, CellData, CellRange, CellStyle, CellValue } from './types';
import { entryContains, shiftEntries, subtractRange, type ValidationEntry, type ValidationRule } from './validation';

export interface SheetModelOptions {
  rows?: number;
  cols?: number;
  defaultColumnWidth?: number;
  defaultRowHeight?: number;
  /** Maximum number of undo steps kept in memory. */
  historyLimit?: number;
  /** Default style applied to the whole sheet (cells without an explicit style inherit it). */
  defaultStyle?: CellStyle;
}

export interface ChangeEvent {
  /** Addresses of cells whose data changed. Empty for pure resize events. */
  cells: CellAddress[];
  /** True when rows/columns were inserted or removed, or the sheet dimensions changed. */
  structural: boolean;
  /** True when column widths or row heights changed. */
  sizes: boolean;
  /** True when validation rules changed. */
  validations: boolean;
  /** Label of the transaction that produced this change ("undo"/"redo" for history). */
  label: string;
  /** True when the change comes from undo/redo. */
  fromHistory: boolean;
}

export interface SheetEvents extends Record<string, unknown> {
  change: ChangeEvent;
  history: { canUndo: boolean; canRedo: boolean };
}

interface CellChange {
  before: CellData | undefined;
  after: CellData | undefined;
}

interface SizeChange {
  before: number | undefined;
  after: number | undefined;
}

interface Transaction {
  label: string;
  cells: Map<string, CellChange>;
  colWidths: Map<number, SizeChange>;
  rowHeights: Map<number, SizeChange>;
  dims: { before: [number, number]; after: [number, number] } | null;
  validations: { before: ValidationEntry[]; after: ValidationEntry[] } | null;
}

export interface SheetSnapshot {
  rows: number;
  cols: number;
  cells: Record<string, CellData>;
  colWidths: Record<string, number>;
  rowHeights: Record<string, number>;
  validations?: ValidationEntry[];
}

export interface ClearOptions {
  values?: boolean;
  styles?: boolean;
  meta?: boolean;
}

function cloneCell(cell: CellData | undefined): CellData | undefined {
  if (!cell) return undefined;
  return {
    value: cell.value,
    style: cell.style ? { ...cell.style } : undefined,
    meta: cell.meta ? { ...cell.meta } : undefined,
  };
}

function cloneEntries(entries: ValidationEntry[]): ValidationEntry[] {
  return entries.map((e) => ({ range: { start: { ...e.range.start }, end: { ...e.range.end } }, rule: { ...e.rule } }));
}

function isEmptyCell(cell: CellData | undefined): boolean {
  if (!cell) return true;
  if (cell.value !== null && cell.value !== undefined && cell.value !== '') return false;
  if (cell.style && Object.keys(cell.style).length > 0) return false;
  if (cell.meta && Object.keys(cell.meta).length > 0) return false;
  return true;
}

function pruneStyle(style: CellStyle | undefined): CellStyle | undefined {
  if (!style) return undefined;
  const out: CellStyle = {};
  let has = false;
  for (const [k, v] of Object.entries(style)) {
    if (v === undefined || v === null) continue;
    if (k.startsWith('border') && v && typeof v === 'object' && (v as { style?: string }).style === 'none') continue;
    (out as Record<string, unknown>)[k] = v;
    has = true;
  }
  return has ? out : undefined;
}

/**
 * Sparse, undoable sheet model.
 *
 * All mutations go through transactions: either explicit (`transact`) or
 * implicit (each public mutator opens one if none is active). A transaction
 * records the before/after state of every touched cell and size so it can be
 * undone/redone precisely, and emits a single `change` event when it ends.
 */
export class SheetModel {
  readonly events = new Emitter<SheetEvents>();
  readonly defaultColumnWidth: number;
  readonly defaultRowHeight: number;
  defaultStyle: CellStyle;

  private _rows: number;
  private _cols: number;
  private cells = new Map<string, CellData>();
  private colWidths = new Map<number, number>();
  private rowHeights = new Map<number, number>();
  private validations: ValidationEntry[] = [];
  private undoStack: Transaction[] = [];
  private redoStack: Transaction[] = [];
  private tx: Transaction | null = null;
  private txDepth = 0;
  private readonly historyLimit: number;

  constructor(options: SheetModelOptions = {}) {
    this._rows = options.rows ?? 1000;
    this._cols = options.cols ?? 52;
    this.defaultColumnWidth = options.defaultColumnWidth ?? 80;
    this.defaultRowHeight = options.defaultRowHeight ?? 22;
    this.historyLimit = options.historyLimit ?? 200;
    this.defaultStyle = { fontFamily: 'Calibri, "Yu Gothic", Meiryo, sans-serif', fontSize: 11, ...options.defaultStyle };
  }

  get rowCount(): number {
    return this._rows;
  }

  get colCount(): number {
    return this._cols;
  }

  // ---------------------------------------------------------------------------
  // Reading
  // ---------------------------------------------------------------------------

  /** Returns the stored cell (do not mutate; use the setters). */
  getCell(row: number, col: number): CellData | undefined {
    return this.cells.get(cellKey(row, col));
  }

  getValue(row: number, col: number): CellValue {
    return this.cells.get(cellKey(row, col))?.value ?? null;
  }

  getStyle(row: number, col: number): CellStyle {
    return this.cells.get(cellKey(row, col))?.style ?? {};
  }

  /** Style merged with the sheet default. */
  getEffectiveStyle(row: number, col: number): CellStyle {
    return { ...this.defaultStyle, ...this.getStyle(row, col) };
  }

  /** Iterate all non-empty cells. */
  *entries(): Generator<[CellAddress, CellData]> {
    for (const [key, data] of this.cells) yield [parseCellKey(key), data];
  }

  get cellCount(): number {
    return this.cells.size;
  }

  /** Smallest range containing every non-empty cell, or null when the sheet is empty. */
  usedRange(): CellRange | null {
    let minR = Infinity;
    let minC = Infinity;
    let maxR = -1;
    let maxC = -1;
    for (const [key, data] of this.cells) {
      if (isEmptyCell(data)) continue;
      const { row, col } = parseCellKey(key);
      if (row < minR) minR = row;
      if (col < minC) minC = col;
      if (row > maxR) maxR = row;
      if (col > maxC) maxC = col;
    }
    if (maxR < 0) return null;
    return { start: { row: minR, col: minC }, end: { row: maxR, col: maxC } };
  }

  hasContent(row: number, col: number): boolean {
    const v = this.getValue(row, col);
    return v !== null && v !== '';
  }

  getColumnWidth(col: number): number {
    return this.colWidths.get(col) ?? this.defaultColumnWidth;
  }

  getRowHeight(row: number): number {
    return this.rowHeights.get(row) ?? this.defaultRowHeight;
  }

  // ---------------------------------------------------------------------------
  // Transactions & history
  // ---------------------------------------------------------------------------

  /**
   * Run `fn` inside a transaction. Nested calls join the outer transaction.
   * Returns the value returned by `fn`.
   */
  transact<T>(label: string, fn: () => T): T {
    const outermost = this.txDepth === 0;
    if (outermost) {
      this.tx = { label, cells: new Map(), colWidths: new Map(), rowHeights: new Map(), dims: null, validations: null };
    }
    this.txDepth++;
    try {
      return fn();
    } finally {
      this.txDepth--;
      if (outermost) {
        const tx = this.tx!;
        this.tx = null;
        this.finishTransaction(tx, false);
      }
    }
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  undo(): boolean {
    const tx = this.undoStack.pop();
    if (!tx) return false;
    this.applyTransaction(tx, 'before');
    this.redoStack.push(tx);
    this.emitChange(tx, 'undo', true);
    return true;
  }

  redo(): boolean {
    const tx = this.redoStack.pop();
    if (!tx) return false;
    this.applyTransaction(tx, 'after');
    this.undoStack.push(tx);
    this.emitChange(tx, 'redo', true);
    return true;
  }

  clearHistory(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.events.emit('history', { canUndo: false, canRedo: false });
  }

  private finishTransaction(tx: Transaction, fromHistory: boolean): void {
    // Drop no-op entries.
    for (const [key, ch] of tx.cells) {
      if (JSON.stringify(ch.before ?? null) === JSON.stringify(ch.after ?? null)) tx.cells.delete(key);
    }
    for (const [k, ch] of tx.colWidths) if (ch.before === ch.after) tx.colWidths.delete(k);
    for (const [k, ch] of tx.rowHeights) if (ch.before === ch.after) tx.rowHeights.delete(k);
    if (tx.dims && tx.dims.before[0] === tx.dims.after[0] && tx.dims.before[1] === tx.dims.after[1]) tx.dims = null;
    if (tx.validations && JSON.stringify(tx.validations.before) === JSON.stringify(tx.validations.after)) tx.validations = null;
    const empty = tx.cells.size === 0 && tx.colWidths.size === 0 && tx.rowHeights.size === 0 && !tx.dims && !tx.validations;
    if (empty) return;
    this.undoStack.push(tx);
    if (this.undoStack.length > this.historyLimit) this.undoStack.shift();
    this.redoStack = [];
    this.emitChange(tx, tx.label, fromHistory);
  }

  private emitChange(tx: Transaction, label: string, fromHistory: boolean): void {
    const cells = Array.from(tx.cells.keys()).map(parseCellKey);
    this.events.emit('change', {
      cells,
      structural: tx.dims !== null,
      sizes: tx.colWidths.size > 0 || tx.rowHeights.size > 0,
      validations: tx.validations !== null,
      label,
      fromHistory,
    });
    this.events.emit('history', { canUndo: this.canUndo, canRedo: this.canRedo });
  }

  private applyTransaction(tx: Transaction, side: 'before' | 'after'): void {
    if (tx.dims) {
      const [r, c] = tx.dims[side];
      this._rows = r;
      this._cols = c;
    }
    if (tx.validations) this.validations = cloneEntries(tx.validations[side]);
    for (const [key, ch] of tx.cells) {
      const data = cloneCell(ch[side]);
      if (data) this.cells.set(key, data);
      else this.cells.delete(key);
    }
    for (const [col, ch] of tx.colWidths) {
      const v = ch[side];
      if (v === undefined) this.colWidths.delete(col);
      else this.colWidths.set(col, v);
    }
    for (const [row, ch] of tx.rowHeights) {
      const v = ch[side];
      if (v === undefined) this.rowHeights.delete(row);
      else this.rowHeights.set(row, v);
    }
  }

  private mutate<T>(label: string, fn: () => T): T {
    if (this.tx) return fn();
    return this.transact(label, fn);
  }

  private writeCell(row: number, col: number, data: CellData | undefined): void {
    const key = cellKey(row, col);
    const tx = this.tx!;
    const prev = this.cells.get(key);
    const next = isEmptyCell(data) ? undefined : (data as CellData);
    let ch = tx.cells.get(key);
    if (!ch) {
      ch = { before: cloneCell(prev), after: undefined };
      tx.cells.set(key, ch);
    }
    ch.after = cloneCell(next);
    if (next) this.cells.set(key, next);
    else this.cells.delete(key);
  }

  private writeColWidth(col: number, width: number | undefined): void {
    const tx = this.tx!;
    let ch = tx.colWidths.get(col);
    if (!ch) {
      ch = { before: this.colWidths.get(col), after: undefined };
      tx.colWidths.set(col, ch);
    }
    ch.after = width;
    if (width === undefined) this.colWidths.delete(col);
    else this.colWidths.set(col, width);
  }

  private writeRowHeight(row: number, height: number | undefined): void {
    const tx = this.tx!;
    let ch = tx.rowHeights.get(row);
    if (!ch) {
      ch = { before: this.rowHeights.get(row), after: undefined };
      tx.rowHeights.set(row, ch);
    }
    ch.after = height;
    if (height === undefined) this.rowHeights.delete(row);
    else this.rowHeights.set(row, height);
  }

  private writeValidations(next: ValidationEntry[]): void {
    const tx = this.tx!;
    if (!tx.validations) tx.validations = { before: cloneEntries(this.validations), after: [] };
    tx.validations.after = cloneEntries(next);
    this.validations = next;
  }

  private writeDims(rows: number, cols: number): void {
    const tx = this.tx!;
    if (!tx.dims) tx.dims = { before: [this._rows, this._cols], after: [rows, cols] };
    else tx.dims.after = [rows, cols];
    this._rows = rows;
    this._cols = cols;
  }

  // ---------------------------------------------------------------------------
  // Writing
  // ---------------------------------------------------------------------------

  /** Replace the whole cell. Passing `null`/`undefined` removes it. */
  setCell(row: number, col: number, data: CellData | null | undefined): void {
    this.mutate('setCell', () => {
      this.writeCell(row, col, data ? { ...data, style: pruneStyle(data.style) } : undefined);
    });
  }

  setValue(row: number, col: number, value: CellValue): void {
    this.mutate('setValue', () => {
      const prev = this.cells.get(cellKey(row, col));
      this.writeCell(row, col, { ...(prev ?? {}), value });
    });
  }

  /** Merge `patch` into the cell's style. `undefined` values remove the property. */
  setStyle(row: number, col: number, patch: Partial<CellStyle>): void {
    this.mutate('setStyle', () => {
      const prev = this.cells.get(cellKey(row, col));
      const style = pruneStyle({ ...(prev?.style ?? {}), ...patch });
      this.writeCell(row, col, { value: prev?.value ?? null, meta: prev?.meta, style });
    });
  }

  setMeta(row: number, col: number, patch: Record<string, unknown> | null): void {
    this.mutate('setMeta', () => {
      const prev = this.cells.get(cellKey(row, col));
      let meta: Record<string, unknown> | undefined;
      if (patch) {
        meta = { ...(prev?.meta ?? {}) };
        for (const [k, v] of Object.entries(patch)) {
          if (v === undefined) delete meta[k];
          else meta[k] = v;
        }
        if (Object.keys(meta).length === 0) meta = undefined;
      }
      this.writeCell(row, col, { value: prev?.value ?? null, style: prev?.style, meta });
    });
  }

  /** Apply the same style patch to every cell in a range. */
  applyStyle(range: CellRange, patch: Partial<CellStyle>): void {
    this.mutate('applyStyle', () => {
      for (const { row, col } of iterateRange(range)) this.setStyle(row, col, patch);
    });
  }

  /** Clear values and/or styles in a range. Defaults to clearing values only (like Excel's Delete key). */
  clearRange(range: CellRange, options: ClearOptions = { values: true }): void {
    const clearValues = options.values ?? false;
    const clearStyles = options.styles ?? false;
    const clearMeta = options.meta ?? clearValues;
    this.mutate('clearRange', () => {
      for (const { row, col } of iterateRange(range)) {
        const prev = this.cells.get(cellKey(row, col));
        if (!prev) continue;
        this.writeCell(row, col, {
          value: clearValues ? null : prev.value,
          style: clearStyles ? undefined : prev.style,
          meta: clearMeta ? undefined : prev.meta,
        });
      }
    });
  }

  /** Write a 2D block of cells starting at `origin`. `null` entries are skipped, `{value:null}` clears. */
  setCells(origin: CellAddress, block: (CellData | null | undefined)[][]): void {
    this.mutate('setCells', () => {
      this.ensureSize(origin.row + block.length, origin.col + Math.max(0, ...block.map((r) => r.length)));
      block.forEach((rowData, r) => {
        rowData.forEach((cell, c) => {
          if (cell === null || cell === undefined) return;
          this.writeCell(origin.row + r, origin.col + c, { ...cell, style: pruneStyle(cell.style) });
        });
      });
    });
  }

  /** Read a 2D block of (cloned) cells for a range. Missing cells are `{ value: null }`. */
  getCells(range: CellRange): CellData[][] {
    const r = normalizeRange(range);
    const out: CellData[][] = [];
    for (let row = r.start.row; row <= r.end.row; row++) {
      const line: CellData[] = [];
      for (let col = r.start.col; col <= r.end.col; col++) {
        line.push(cloneCell(this.cells.get(cellKey(row, col))) ?? { value: null });
      }
      out.push(line);
    }
    return out;
  }

  setColumnWidth(col: number, width: number | undefined): void {
    this.mutate('resizeColumn', () => this.writeColWidth(col, width === undefined ? undefined : Math.max(0, width)));
  }

  setRowHeight(row: number, height: number | undefined): void {
    this.mutate('resizeRow', () => this.writeRowHeight(row, height === undefined ? undefined : Math.max(0, height)));
  }

  /** Grow the sheet so that it has at least the given number of rows/cols. */
  ensureSize(rows: number, cols: number): void {
    if (rows <= this._rows && cols <= this._cols) return;
    this.mutate('resize', () => this.writeDims(Math.max(rows, this._rows), Math.max(cols, this._cols)));
  }

  resize(rows: number, cols: number): void {
    this.mutate('resize', () => {
      // Remove cells outside the new bounds.
      for (const key of Array.from(this.cells.keys())) {
        const { row, col } = parseCellKey(key);
        if (row >= rows || col >= cols) this.writeCell(row, col, undefined);
      }
      this.writeDims(rows, cols);
    });
  }

  // ---------------------------------------------------------------------------
  // Data validation
  // ---------------------------------------------------------------------------

  /**
   * Set (or with `null`, remove) the validation rule for a range. Later rules
   * win over earlier ones; use `columnRange(col)` / `rowRange(row)` to cover
   * a whole column/row including rows added later.
   */
  setValidation(range: CellRange, rule: ValidationRule | null): void {
    this.mutate('validation', () => {
      const r = normalizeRange(range);
      const rest = subtractRange(this.validations, r);
      this.writeValidations(rule ? [...rest, { range: r, rule: { ...rule } }] : rest);
    });
  }

  /** The rule applying to a cell, if any. */
  getValidation(row: number, col: number): ValidationRule | undefined {
    const addr = { row, col };
    for (let i = this.validations.length - 1; i >= 0; i--) {
      if (entryContains(this.validations[i], addr)) return this.validations[i].rule;
    }
    return undefined;
  }

  /** All validation entries (copies). */
  getValidations(): ValidationEntry[] {
    return cloneEntries(this.validations);
  }

  clearValidations(): void {
    this.mutate('validation', () => this.writeValidations([]));
  }

  // ---------------------------------------------------------------------------
  // Structural operations
  // ---------------------------------------------------------------------------

  insertRows(at: number, count = 1): void {
    if (count <= 0) return;
    this.mutate('insertRows', () => {
      this.shiftAxis('row', at, count);
      this.writeDims(this._rows + count, this._cols);
    });
  }

  deleteRows(at: number, count = 1): void {
    if (count <= 0) return;
    this.mutate('deleteRows', () => {
      this.shiftAxis('row', at, -count);
      this.writeDims(Math.max(1, this._rows - count), this._cols);
    });
  }

  /** Add empty rows at the bottom of the sheet. */
  appendRows(count = 1): void {
    this.insertRows(this._rows, count);
  }

  /** Add empty columns at the right of the sheet. */
  appendColumns(count = 1): void {
    this.insertColumns(this._cols, count);
  }

  insertColumns(at: number, count = 1): void {
    if (count <= 0) return;
    this.mutate('insertColumns', () => {
      this.shiftAxis('col', at, count);
      this.writeDims(this._rows, this._cols + count);
    });
  }

  deleteColumns(at: number, count = 1): void {
    if (count <= 0) return;
    this.mutate('deleteColumns', () => {
      this.shiftAxis('col', at, -count);
      this.writeDims(this._rows, Math.max(1, this._cols - count));
    });
  }

  /**
   * Shift cells (and sizes) along an axis. A positive delta inserts `delta`
   * empty rows/cols at `at`; a negative delta removes `-delta` rows/cols
   * starting at `at`.
   */
  private shiftAxis(axis: 'row' | 'col', at: number, delta: number): void {
    const removedEnd = delta < 0 ? at - delta : at; // exclusive
    const moved: [string, CellData][] = [];
    for (const [key, data] of Array.from(this.cells.entries())) {
      const addr = parseCellKey(key);
      const idx = axis === 'row' ? addr.row : addr.col;
      if (idx < at) continue;
      // Every cell at/after `at` is rewritten.
      this.writeCell(addr.row, addr.col, undefined);
      if (delta < 0 && idx < removedEnd) continue; // deleted
      const nidx = idx + delta;
      const naddr = axis === 'row' ? { row: nidx, col: addr.col } : { row: addr.row, col: nidx };
      moved.push([cellKey(naddr.row, naddr.col), data]);
    }
    for (const [key, data] of moved) {
      const { row, col } = parseCellKey(key);
      this.writeCell(row, col, cloneCell(data));
    }
    const sizes = axis === 'row' ? this.rowHeights : this.colWidths;
    const write = axis === 'row' ? this.writeRowHeight.bind(this) : this.writeColWidth.bind(this);
    const movedSizes: [number, number][] = [];
    for (const [idx, size] of Array.from(sizes.entries())) {
      if (idx < at) continue;
      write(idx, undefined);
      if (delta < 0 && idx < removedEnd) continue;
      movedSizes.push([idx + delta, size]);
    }
    for (const [idx, size] of movedSizes) write(idx, size);
    if (this.validations.length) this.writeValidations(shiftEntries(this.validations, axis, at, delta));
  }

  // ---------------------------------------------------------------------------
  // Serialisation
  // ---------------------------------------------------------------------------

  toJSON(): SheetSnapshot {
    const cells: Record<string, CellData> = {};
    for (const [key, data] of this.cells) cells[key] = cloneCell(data)!;
    const colWidths: Record<string, number> = {};
    for (const [k, v] of this.colWidths) colWidths[String(k)] = v;
    const rowHeights: Record<string, number> = {};
    for (const [k, v] of this.rowHeights) rowHeights[String(k)] = v;
    return { rows: this._rows, cols: this._cols, cells, colWidths, rowHeights, validations: cloneEntries(this.validations) };
  }

  /** Replace the sheet content with a snapshot. Recorded as a single undoable transaction. */
  load(snapshot: Partial<SheetSnapshot>): void {
    this.transact('load', () => {
      for (const key of Array.from(this.cells.keys())) {
        const { row, col } = parseCellKey(key);
        this.writeCell(row, col, undefined);
      }
      for (const col of Array.from(this.colWidths.keys())) this.writeColWidth(col, undefined);
      for (const row of Array.from(this.rowHeights.keys())) this.writeRowHeight(row, undefined);
      this.writeDims(snapshot.rows ?? this._rows, snapshot.cols ?? this._cols);
      for (const [key, data] of Object.entries(snapshot.cells ?? {})) {
        const { row, col } = parseCellKey(key);
        this.writeCell(row, col, { ...data, style: pruneStyle(data.style) });
      }
      for (const [k, v] of Object.entries(snapshot.colWidths ?? {})) this.writeColWidth(Number(k), v);
      for (const [k, v] of Object.entries(snapshot.rowHeights ?? {})) this.writeRowHeight(Number(k), v);
      this.writeValidations(cloneEntries(snapshot.validations ?? []));
    });
  }
}
