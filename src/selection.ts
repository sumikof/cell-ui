import { Emitter } from './model/emitter';
import { normalizeRange, rangeContains, rangeFromAddress, sameAddress, sameRange } from './model/address';
import type { CellAddress, CellRange } from './model/types';

export type SelectionMode = 'cells' | 'rows' | 'columns' | 'all';

export interface SelectionState {
  /** The active (focused) cell. Always inside `range`. */
  active: CellAddress;
  /** The selected rectangle. */
  range: CellRange;
  /** The cell from which Shift+click / Shift+Arrow extends. */
  anchor: CellAddress;
  mode: SelectionMode;
}

export interface SelectionEvents extends Record<string, unknown> {
  change: SelectionState;
}

/** Single-rectangle selection with an active cell, like Excel's basic selection. */
export class Selection {
  readonly events = new Emitter<SelectionEvents>();
  private state: SelectionState = {
    active: { row: 0, col: 0 },
    range: { start: { row: 0, col: 0 }, end: { row: 0, col: 0 } },
    anchor: { row: 0, col: 0 },
    mode: 'cells',
  };

  constructor(
    private readonly bounds: () => { rows: number; cols: number },
  ) {}

  get active(): CellAddress {
    return this.state.active;
  }

  get range(): CellRange {
    return this.state.range;
  }

  get anchor(): CellAddress {
    return this.state.anchor;
  }

  get mode(): SelectionMode {
    return this.state.mode;
  }

  get isSingleCell(): boolean {
    return sameAddress(this.state.range.start, this.state.range.end);
  }

  snapshot(): SelectionState {
    const s = this.state;
    return { active: { ...s.active }, range: normalizeRange(s.range), anchor: { ...s.anchor }, mode: s.mode };
  }

  private clamp(addr: CellAddress): CellAddress {
    const { rows, cols } = this.bounds();
    return { row: Math.max(0, Math.min(rows - 1, addr.row)), col: Math.max(0, Math.min(cols - 1, addr.col)) };
  }

  private commit(next: SelectionState): void {
    const prev = this.state;
    next.range = normalizeRange(next.range);
    if (!rangeContains(next.range, next.active)) next.active = { ...next.range.start };
    this.state = next;
    if (
      sameAddress(prev.active, next.active) &&
      sameRange(prev.range, next.range) &&
      sameAddress(prev.anchor, next.anchor) &&
      prev.mode === next.mode
    ) {
      return;
    }
    this.events.emit('change', this.snapshot());
  }

  /** Select a single cell and make it active. */
  setActive(addr: CellAddress): void {
    const a = this.clamp(addr);
    this.commit({ active: a, anchor: { ...a }, range: rangeFromAddress(a), mode: 'cells' });
  }

  /** Extend the selection from the anchor to `addr` (Shift+click / Shift+Arrow). */
  extendTo(addr: CellAddress): void {
    const a = this.clamp(addr);
    const { rows, cols } = this.bounds();
    const anchor = this.state.anchor;
    let range: CellRange;
    let mode: SelectionMode = 'cells';
    if (this.state.mode === 'rows' || this.state.mode === 'all') {
      range = { start: { row: anchor.row, col: 0 }, end: { row: a.row, col: cols - 1 } };
      mode = 'rows';
    } else if (this.state.mode === 'columns') {
      range = { start: { row: 0, col: anchor.col }, end: { row: rows - 1, col: a.col } };
      mode = 'columns';
    } else {
      range = { start: { ...anchor }, end: a };
    }
    this.commit({ active: { ...this.state.active }, anchor: { ...anchor }, range, mode });
  }

  /** Select an arbitrary range; `active` defaults to the range start. */
  selectRange(range: CellRange, active?: CellAddress, mode: SelectionMode = 'cells'): void {
    const r = normalizeRange({ start: this.clamp(range.start), end: this.clamp(range.end) });
    const act = active ? this.clamp(active) : { ...r.start };
    this.commit({ active: act, anchor: { ...r.start }, range: r, mode });
  }

  selectRows(from: number, to: number = from, activeCol = 0): void {
    const { rows, cols } = this.bounds();
    const range = { start: { row: from, col: 0 }, end: { row: to, col: cols - 1 } };
    const r = normalizeRange(range);
    const all = r.start.row === 0 && r.end.row === rows - 1;
    this.commit({
      active: this.clamp({ row: from, col: activeCol }),
      anchor: { row: from, col: 0 },
      range: r,
      mode: all ? 'all' : 'rows',
    });
  }

  selectColumns(from: number, to: number = from, activeRow = 0): void {
    const { rows, cols } = this.bounds();
    const range = { start: { row: 0, col: from }, end: { row: rows - 1, col: to } };
    const r = normalizeRange(range);
    const all = r.start.col === 0 && r.end.col === cols - 1;
    this.commit({
      active: this.clamp({ row: activeRow, col: from }),
      anchor: { row: 0, col: from },
      range: r,
      mode: all ? 'all' : 'columns',
    });
  }

  selectAll(): void {
    const { rows, cols } = this.bounds();
    this.commit({
      active: { ...this.state.active },
      anchor: { row: 0, col: 0 },
      range: { start: { row: 0, col: 0 }, end: { row: rows - 1, col: cols - 1 } },
      mode: 'all',
    });
  }

  /** Move the active cell inside the current multi-cell selection (Enter/Tab behaviour). */
  moveActiveWithin(dRow: number, dCol: number): void {
    const r = normalizeRange(this.state.range);
    const rows = r.end.row - r.start.row + 1;
    const cols = r.end.col - r.start.col + 1;
    let row = this.state.active.row - r.start.row;
    let col = this.state.active.col - r.start.col;
    if (dCol !== 0) {
      col += dCol;
      if (col >= cols) {
        col = 0;
        row = (row + 1) % rows;
      } else if (col < 0) {
        col = cols - 1;
        row = (row - 1 + rows) % rows;
      }
    } else if (dRow !== 0) {
      row += dRow;
      if (row >= rows) {
        row = 0;
        col = (col + 1) % cols;
      } else if (row < 0) {
        row = rows - 1;
        col = (col - 1 + cols) % cols;
      }
    }
    this.commit({ ...this.state, active: { row: r.start.row + row, col: r.start.col + col } });
  }

  /** Re-clamp after the sheet was resized. */
  revalidate(): void {
    const s = this.state;
    this.commit({
      active: this.clamp(s.active),
      anchor: this.clamp(s.anchor),
      range: { start: this.clamp(s.range.start), end: this.clamp(s.range.end) },
      mode: s.mode,
    });
  }
}
