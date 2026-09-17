import type { Spreadsheet } from '../spreadsheet';
import type { BorderStyle, CellAddress, CellData, CellRange, CellStyle } from '../model/types';
import { normalizeRange, rangeContains, rangeSize, columnLabel, sameAddress } from '../model/address';
import { defaultAlign } from '../model/value';
import { AxisLayout } from './layout';

/** Default row-header width / column-header height in px (override with the `rowHeaderWidth` / `columnHeaderHeight` options). */
export const ROW_HEADER_WIDTH = 46;
export const COL_HEADER_HEIGHT = 22;
const RESIZE_ZONE = 5;
const BORDER_PX: Record<BorderStyle['style'], number> = { none: 0, thin: 1, medium: 2, thick: 3, dashed: 1, dotted: 1, double: 3 };

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, parent?: HTMLElement): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  parent?.appendChild(e);
  return e;
}

function px(n: number): string {
  return `${Math.round(n)}px`;
}

type DragMode =
  | { kind: 'select' }
  | { kind: 'select-rows' }
  | { kind: 'select-cols' }
  | { kind: 'resize-col'; index: number; startX: number; startSize: number; guide: HTMLElement }
  | { kind: 'resize-row'; index: number; startY: number; startSize: number; guide: HTMLElement }
  | { kind: 'fill'; source: CellRange; target: CellRange | null };

export interface EditorPlacement {
  address: CellAddress;
  style: CellStyle;
}

/**
 * DOM renderer for the sheet: virtualised cells, headers, gridlines,
 * borders, selection overlay and the in-cell editor. Mouse interaction that
 * changes the selection/model is forwarded to the owning `Spreadsheet`.
 */
export class GridView {
  readonly root: HTMLElement;
  readonly viewport: HTMLElement;
  readonly editor: HTMLTextAreaElement;
  private readonly corner: HTMLElement;
  private readonly colWrap: HTMLElement;
  private readonly rowWrap: HTMLElement;
  private readonly colHeader: HTMLElement;
  private readonly rowHeader: HTMLElement;
  private readonly canvas: HTMLElement;
  private readonly gridlines: HTMLElement;
  private readonly cellsLayer: HTMLElement;
  private readonly bordersLayer: HTMLElement;
  private readonly overlay: HTMLElement;
  private readonly rangeParts: HTMLElement[] = [];
  private readonly activeBox: HTMLElement;
  private readonly fillHandle: HTMLElement;
  private readonly cutMarquee: HTMLElement;
  private readonly fillPreview: HTMLElement;

  readonly rows: AxisLayout;
  readonly cols: AxisLayout;

  private cellPool = new Map<string, HTMLElement>();
  private colHeaderPool = new Map<number, HTMLElement>();
  private rowHeaderPool = new Map<number, HTMLElement>();
  private measureCtx: CanvasRenderingContext2D | null = null;
  private renderQueued = false;
  private drag: DragMode | null = null;
  private lastPointer = { x: 0, y: 0 };
  private autoScrollTimer: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private editing: EditorPlacement | null = null;
  private disposed = false;

  constructor(private readonly sheet: Spreadsheet) {
    const model = sheet.model;
    this.rows = new AxisLayout(() => model.rowCount, (i) => model.getRowHeight(i));
    this.cols = new AxisLayout(() => model.colCount, (i) => model.getColumnWidth(i));

    this.root = el('div', 'cui-grid');
    this.corner = el('div', 'cui-corner', this.root);
    this.colWrap = el('div', 'cui-colheader-wrap', this.root);
    this.colHeader = el('div', 'cui-colheader', this.colWrap);
    this.rowWrap = el('div', 'cui-rowheader-wrap', this.root);
    this.rowHeader = el('div', 'cui-rowheader', this.rowWrap);
    this.viewport = el('div', 'cui-viewport', this.root);
    this.applyLayoutOptions();
    this.canvas = el('div', 'cui-canvas', this.viewport);
    this.gridlines = el('div', 'cui-gridlines', this.canvas);
    this.cellsLayer = el('div', 'cui-cells', this.canvas);
    this.bordersLayer = el('div', 'cui-borders', this.canvas);
    this.overlay = el('div', 'cui-overlay', this.canvas);
    for (let i = 0; i < 4; i++) this.rangeParts.push(el('div', 'cui-range', this.overlay));
    this.cutMarquee = el('div', 'cui-cut-marquee', this.overlay);
    this.fillPreview = el('div', 'cui-fill-preview', this.overlay);
    this.activeBox = el('div', 'cui-active', this.overlay);
    this.fillHandle = el('div', 'cui-fill-handle', this.overlay);
    this.editor = el('textarea', 'cui-editor', this.canvas);
    this.editor.setAttribute('autocomplete', 'off');
    this.editor.setAttribute('autocorrect', 'off');
    this.editor.setAttribute('autocapitalize', 'off');
    this.editor.setAttribute('spellcheck', 'false');
    this.editor.setAttribute('aria-label', 'Cell editor');
    this.editor.rows = 1;

    this.bindEvents();
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  mount(): void {
    this.applyLayoutOptions();
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.scheduleRender());
      this.resizeObserver.observe(this.viewport);
    }
    this.scheduleRender();
  }

  destroy(): void {
    this.disposed = true;
    this.resizeObserver?.disconnect();
    this.stopAutoScroll();
    this.root.remove();
  }

  invalidateLayout(): void {
    this.rows.invalidate();
    this.cols.invalidate();
  }

  scheduleRender(): void {
    if (this.renderQueued || this.disposed) return;
    this.renderQueued = true;
    const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (cb: () => void) => setTimeout(cb, 0);
    raf(() => {
      this.renderQueued = false;
      if (!this.disposed) this.render();
    });
  }

  // ---------------------------------------------------------------------------
  // Geometry helpers
  // ---------------------------------------------------------------------------

  cellRect(addr: CellAddress): { left: number; top: number; width: number; height: number } {
    return {
      left: this.cols.offset(addr.col),
      top: this.rows.offset(addr.row),
      width: this.cols.size(addr.col),
      height: this.rows.size(addr.row),
    };
  }

  rangeRect(range: CellRange): { left: number; top: number; width: number; height: number } {
    const r = normalizeRange(range);
    const left = this.cols.offset(r.start.col);
    const top = this.rows.offset(r.start.row);
    return {
      left,
      top,
      width: this.cols.offset(r.end.col + 1) - left,
      height: this.rows.offset(r.end.row + 1) - top,
    };
  }

  /** Address under a point given in viewport-content coordinates. */
  addressAt(x: number, y: number): CellAddress {
    return { row: this.rows.indexAt(y), col: this.cols.indexAt(x) };
  }

  private pointerToContent(e: MouseEvent): { x: number; y: number } {
    const rect = this.viewport.getBoundingClientRect();
    return { x: e.clientX - rect.left + this.viewport.scrollLeft, y: e.clientY - rect.top + this.viewport.scrollTop };
  }

  get visibleRows(): [number, number] {
    const top = this.viewport.scrollTop;
    return this.rows.visibleRange(top, top + this.viewport.clientHeight);
  }

  get visibleCols(): [number, number] {
    const left = this.viewport.scrollLeft;
    return this.cols.visibleRange(left, left + this.viewport.clientWidth);
  }

  scrollIntoView(addr: CellAddress): void {
    const rect = this.cellRect(addr);
    const vp = this.viewport;
    let sl = vp.scrollLeft;
    let st = vp.scrollTop;
    if (rect.left < sl) sl = rect.left;
    else if (rect.left + rect.width > sl + vp.clientWidth) sl = rect.left + rect.width - vp.clientWidth;
    if (rect.top < st) st = rect.top;
    else if (rect.top + rect.height > st + vp.clientHeight) st = rect.top + rect.height - vp.clientHeight;
    if (sl !== vp.scrollLeft || st !== vp.scrollTop) {
      vp.scrollLeft = sl;
      vp.scrollTop = st;
      this.scheduleRender();
    }
  }

  scrollBy(dx: number, dy: number): void {
    this.viewport.scrollLeft += dx;
    this.viewport.scrollTop += dy;
    this.scheduleRender();
  }

  get pageRows(): number {
    const [a, b] = this.visibleRows;
    return Math.max(1, b - a);
  }

  get pageCols(): number {
    const [a, b] = this.visibleCols;
    return Math.max(1, b - a);
  }

  // ---------------------------------------------------------------------------
  // Text measurement
  // ---------------------------------------------------------------------------

  measureText(text: string, style: CellStyle): number {
    if (!this.measureCtx) {
      const c = document.createElement('canvas');
      this.measureCtx = c.getContext('2d');
      if (!this.measureCtx) return text.length * 8;
    }
    const ctx = this.measureCtx;
    ctx.font = this.cssFont(style);
    let max = 0;
    for (const line of text.split('\n')) max = Math.max(max, ctx.measureText(line).width);
    return max;
  }

  cssFont(style: CellStyle): string {
    const size = ((style.fontSize ?? 11) * 4) / 3;
    return `${style.italic ? 'italic ' : ''}${style.bold ? 'bold ' : ''}${size}px ${style.fontFamily ?? 'sans-serif'}`;
  }

  /** Width needed to show every cell in a column without clipping (Excel's AutoFit). */
  autoFitWidth(col: number): number {
    const model = this.sheet.model;
    let best = 0;
    for (const [addr, data] of model.entries()) {
      if (addr.col !== col) continue;
      const text = this.sheet.displayText(addr, data);
      if (!text) continue;
      best = Math.max(best, this.measureText(text, model.getEffectiveStyle(addr.row, addr.col)) + 8);
    }
    return Math.max(20, Math.ceil(best) || model.defaultColumnWidth);
  }

  autoFitHeight(row: number): number {
    const model = this.sheet.model;
    let best = 0;
    for (const [addr, data] of model.entries()) {
      if (addr.row !== row) continue;
      const text = this.sheet.displayText(addr, data);
      if (!text) continue;
      const style = model.getEffectiveStyle(addr.row, addr.col);
      const lineHeight = ((style.fontSize ?? 11) * 4) / 3 * 1.3;
      let lines = text.split('\n').length;
      if (style.wrap) {
        const width = this.cols.size(addr.col) - 6;
        for (const line of text.split('\n')) lines += Math.max(0, Math.ceil(this.measureText(line, style) / Math.max(1, width)) - 1);
      }
      best = Math.max(best, lines * lineHeight + 4);
    }
    return Math.max(12, Math.ceil(best) || model.defaultRowHeight);
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  /** Width of the row-header column (0 when row headers are hidden). */
  get headerWidth(): number {
    const o = this.sheet.options;
    const h = o.headers;
    const show = h === undefined || h === true || (typeof h === 'object' && h.rows !== false);
    return show ? (o.rowHeaderWidth ?? ROW_HEADER_WIDTH) : 0;
  }

  /** Height of the column-header row (0 when column headers are hidden). */
  get headerHeight(): number {
    const o = this.sheet.options;
    const h = o.headers;
    const show = h === undefined || h === true || (typeof h === 'object' && h.cols !== false);
    return show ? (o.columnHeaderHeight ?? COL_HEADER_HEIGHT) : 0;
  }

  /**
   * Apply layout-affecting options: header visibility/size and `fitContent`.
   * Called on every render so options can be changed at runtime.
   */
  applyLayoutOptions(): void {
    const hw = this.headerWidth;
    const hh = this.headerHeight;
    this.corner.style.width = px(hw);
    this.corner.style.height = px(hh);
    this.corner.style.display = hw && hh ? '' : 'none';
    this.colWrap.style.left = px(hw);
    this.colWrap.style.height = px(hh);
    this.colWrap.style.display = hh ? '' : 'none';
    this.rowWrap.style.top = px(hh);
    this.rowWrap.style.width = px(hw);
    this.rowWrap.style.display = hw ? '' : 'none';
    this.viewport.style.left = px(hw);
    this.viewport.style.top = px(hh);

    const fit = this.sheet.options.fitContent;
    const rootEl = this.sheet.root;
    const fitH = fit === true || fit === 'height';
    const fitW = fit === true || fit === 'width';
    rootEl.classList.toggle('cui-root--fit-height', fitH);
    rootEl.classList.toggle('cui-root--fit-width', fitW);
    // 3px of slack keeps the fill handle / selection border of the last cell visible.
    this.root.style.height = fitH ? px(hh + this.rows.total + 3) : '';
    this.root.style.width = fitW ? px(hw + this.cols.total + 3) : '';
    rootEl.style.width = fitW ? px(hw + this.cols.total + 3 + 2) : '';
  }

  render(): void {
    const vp = this.viewport;
    this.applyLayoutOptions();
    this.canvas.style.width = px(this.cols.total);
    this.canvas.style.height = px(this.rows.total);
    const [r0, r1] = this.visibleRows;
    const [c0, c1] = this.visibleCols;
    this.renderGridlines(r0, r1, c0, c1);
    this.renderCells(r0, r1, c0, c1);
    this.renderHeaders(r0, r1, c0, c1);
    this.renderSelection();
    this.positionEditor();
    this.colHeader.style.transform = `translateX(${-vp.scrollLeft}px)`;
    this.rowHeader.style.transform = `translateY(${-vp.scrollTop}px)`;
  }

  private renderGridlines(r0: number, r1: number, c0: number, c1: number): void {
    const vp = this.viewport;
    const left = vp.scrollLeft;
    const top = vp.scrollTop;
    const right = Math.min(left + vp.clientWidth, this.cols.total);
    const bottom = Math.min(top + vp.clientHeight, this.rows.total);
    const frag = document.createDocumentFragment();
    if (this.sheet.options.showGridlines !== false) {
      for (let c = c0; c <= c1; c++) {
        if (this.cols.size(c) === 0) continue;
        const line = el('div', 'cui-gridline-v');
        line.style.left = px(this.cols.offset(c + 1) - 1);
        line.style.top = px(top);
        line.style.height = px(bottom - top);
        frag.appendChild(line);
      }
      for (let r = r0; r <= r1; r++) {
        if (this.rows.size(r) === 0) continue;
        const line = el('div', 'cui-gridline-h');
        line.style.top = px(this.rows.offset(r + 1) - 1);
        line.style.left = px(left);
        line.style.width = px(right - left);
        frag.appendChild(line);
      }
    }
    this.gridlines.replaceChildren(frag);
  }

  private renderCells(r0: number, r1: number, c0: number, c1: number): void {
    const model = this.sheet.model;
    const needed = new Set<string>();
    const borderFrag = document.createDocumentFragment();
    const [vc0, vc1] = [c0, c1];
    for (let r = r0; r <= r1; r++) {
      const rowH = this.rows.size(r);
      if (rowH === 0) continue;
      for (let c = vc0; c <= vc1; c++) {
        const colW = this.cols.size(c);
        if (colW === 0) continue;
        const key = `${r},${c}`;
        needed.add(key);
        let elem = this.cellPool.get(key);
        if (!elem) {
          elem = el('div', 'cui-cell');
          elem.appendChild(el('div', 'cui-cell-text'));
          this.cellPool.set(key, elem);
          this.cellsLayer.appendChild(elem);
        }
        const data = model.getCell(r, c);
        this.paintCell(elem, { row: r, col: c }, data, colW, rowH, c1);
        this.collectBorders(borderFrag, r, c, data?.style);
      }
    }
    for (const [key, elem] of this.cellPool) {
      if (!needed.has(key)) {
        elem.remove();
        this.cellPool.delete(key);
      }
    }
    this.bordersLayer.replaceChildren(borderFrag);
  }

  private paintCell(elem: HTMLElement, addr: CellAddress, data: CellData | undefined, width: number, height: number, lastVisibleCol: number): void {
    const model = this.sheet.model;
    const style = model.getEffectiveStyle(addr.row, addr.col);
    const text = this.sheet.displayText(addr, data);
    const s = elem.style;
    s.left = px(this.cols.offset(addr.col));
    s.top = px(this.rows.offset(addr.row));
    s.width = px(width);
    s.height = px(height);
    s.background = style.backgroundColor ?? '';
    const textEl = elem.firstElementChild as HTMLElement;
    const ts = textEl.style;
    ts.fontFamily = style.fontFamily ?? '';
    ts.fontSize = style.fontSize ? `${style.fontSize}pt` : '';
    ts.fontWeight = style.bold ? 'bold' : '';
    ts.fontStyle = style.italic ? 'italic' : '';
    const deco: string[] = [];
    if (style.underline) deco.push('underline');
    if (style.strikethrough) deco.push('line-through');
    ts.textDecoration = deco.join(' ');
    ts.color = style.color ?? '';
    const hAlign = style.hAlign ?? defaultAlign(data?.value ?? null);
    ts.textAlign = hAlign;
    ts.justifyContent = hAlign === 'center' ? 'center' : hAlign === 'right' ? 'flex-end' : 'flex-start';
    const vAlign = style.vAlign ?? 'bottom';
    ts.alignItems = vAlign === 'top' ? 'flex-start' : vAlign === 'middle' ? 'center' : 'flex-end';
    ts.whiteSpace = style.wrap ? 'pre-wrap' : 'pre';
    ts.wordBreak = style.wrap ? 'break-word' : '';
    if (textEl.textContent !== text) textEl.textContent = text;

    // Excel-style overflow into empty neighbours to the right for left-aligned text.
    let extra = 0;
    let overflowing = false;
    if (text && !style.wrap && hAlign === 'left' && !text.includes('\n')) {
      const needed = this.measureText(text, style) + 6;
      if (needed > width) {
        let c = addr.col + 1;
        let avail = width;
        const maxCol = Math.min(model.colCount - 1, lastVisibleCol + 1);
        while (avail < needed && c <= maxCol && !model.hasContent(addr.row, c)) {
          avail += this.cols.size(c);
          c++;
        }
        extra = Math.max(0, Math.min(avail, needed) - width);
        overflowing = extra > 0;
      }
    }
    ts.width = extra ? px(width + extra) : '';
    elem.classList.toggle('cui-cell--overflow', overflowing);
    elem.classList.toggle('cui-cell--active', sameAddress(addr, this.sheet.selection.active));
    for (const hook of this.sheet.cellRenderers) hook(elem, data, addr, this.sheet);
  }

  private collectBorders(frag: DocumentFragment, r: number, c: number, style: CellStyle | undefined): void {
    if (!style) return;
    const { borderTop, borderRight, borderBottom, borderLeft } = style;
    if (!borderTop && !borderRight && !borderBottom && !borderLeft) return;
    const x0 = this.cols.offset(c) - 1;
    const x1 = this.cols.offset(c + 1) - 1;
    const y0 = this.rows.offset(r) - 1;
    const y1 = this.rows.offset(r + 1) - 1;
    const line = (b: BorderStyle | undefined, horizontal: boolean, pos: number, from: number, len: number) => {
      if (!b || b.style === 'none') return;
      const w = BORDER_PX[b.style];
      const css = b.style === 'dashed' || b.style === 'dotted' || b.style === 'double' ? b.style : 'solid';
      const d = el('div', horizontal ? 'cui-border-h' : 'cui-border-v');
      const offset = pos - Math.floor((w - 1) / 2);
      if (horizontal) {
        d.style.top = px(offset);
        d.style.left = px(from);
        d.style.width = px(len);
        d.style.borderTop = `${w}px ${css} ${b.color}`;
      } else {
        d.style.left = px(offset);
        d.style.top = px(from);
        d.style.height = px(len);
        d.style.borderLeft = `${w}px ${css} ${b.color}`;
      }
      frag.appendChild(d);
    };
    line(borderTop, true, y0, x0, x1 - x0 + 1);
    line(borderBottom, true, y1, x0, x1 - x0 + 1);
    line(borderLeft, false, x0, y0, y1 - y0 + 1);
    line(borderRight, false, x1, y0, y1 - y0 + 1);
  }

  private renderHeaders(r0: number, r1: number, c0: number, c1: number): void {
    const sel = this.sheet.selection;
    const range = normalizeRange(sel.range);
    const fullCols = sel.mode === 'columns' || sel.mode === 'all';
    const fullRows = sel.mode === 'rows' || sel.mode === 'all';
    this.colHeader.style.width = px(this.cols.total);
    this.rowHeader.style.height = px(this.rows.total);
    if (this.headerHeight === 0) c1 = c0 - 1;
    if (this.headerWidth === 0) r1 = r0 - 1;

    const neededC = new Set<number>();
    for (let c = c0; c <= c1; c++) {
      neededC.add(c);
      let h = this.colHeaderPool.get(c);
      if (!h) {
        h = el('div', 'cui-header cui-header-col');
        h.dataset.col = String(c);
        this.colHeaderPool.set(c, h);
        this.colHeader.appendChild(h);
      }
      const w = this.cols.size(c);
      h.style.left = px(this.cols.offset(c));
      h.style.width = px(w);
      h.style.display = w === 0 ? 'none' : '';
      h.textContent = columnLabel(c);
      const inSel = c >= range.start.col && c <= range.end.col;
      h.classList.toggle('cui-header--selected', inSel);
      h.classList.toggle('cui-header--full', inSel && fullCols);
    }
    for (const [c, h] of this.colHeaderPool) {
      if (!neededC.has(c)) {
        h.remove();
        this.colHeaderPool.delete(c);
      }
    }

    const neededR = new Set<number>();
    for (let r = r0; r <= r1; r++) {
      neededR.add(r);
      let h = this.rowHeaderPool.get(r);
      if (!h) {
        h = el('div', 'cui-header cui-header-row');
        h.dataset.row = String(r);
        this.rowHeaderPool.set(r, h);
        this.rowHeader.appendChild(h);
      }
      const hh = this.rows.size(r);
      h.style.top = px(this.rows.offset(r));
      h.style.height = px(hh);
      h.style.display = hh === 0 ? 'none' : '';
      h.textContent = String(r + 1);
      const inSel = r >= range.start.row && r <= range.end.row;
      h.classList.toggle('cui-header--selected', inSel);
      h.classList.toggle('cui-header--full', inSel && fullRows);
    }
    for (const [r, h] of this.rowHeaderPool) {
      if (!neededR.has(r)) {
        h.remove();
        this.rowHeaderPool.delete(r);
      }
    }
    this.corner.classList.toggle('cui-header--full', sel.mode === 'all');
  }

  private renderSelection(): void {
    const sel = this.sheet.selection;
    const range = normalizeRange(sel.range);
    const rr = this.rangeRect(range);
    const ar = this.cellRect(sel.active);
    const multi = !sel.isSingleCell;

    // Range fill: four strips around the active cell so that it stays unfilled.
    const strips = multi
      ? [
          { left: rr.left, top: rr.top, width: rr.width, height: ar.top - rr.top },
          { left: rr.left, top: ar.top + ar.height, width: rr.width, height: rr.top + rr.height - (ar.top + ar.height) },
          { left: rr.left, top: ar.top, width: ar.left - rr.left, height: ar.height },
          { left: ar.left + ar.width, top: ar.top, width: rr.left + rr.width - (ar.left + ar.width), height: ar.height },
        ]
      : [];
    this.rangeParts.forEach((part, i) => {
      const s = strips[i];
      if (!s || s.width <= 0 || s.height <= 0) {
        part.style.display = 'none';
        return;
      }
      part.style.display = '';
      part.style.left = px(s.left);
      part.style.top = px(s.top);
      part.style.width = px(s.width);
      part.style.height = px(s.height);
    });

    // Border around the whole range (or the active cell).
    const box = this.activeBox.style;
    box.left = px(rr.left - 1);
    box.top = px(rr.top - 1);
    box.width = px(rr.width + 1);
    box.height = px(rr.height + 1);
    this.activeBox.style.display = this.editing ? 'none' : '';

    const fh = this.fillHandle.style;
    fh.left = px(rr.left + rr.width - 4);
    fh.top = px(rr.top + rr.height - 4);
    this.fillHandle.style.display = this.editing || this.sheet.options.fillHandle === false ? 'none' : '';

    const cut = this.sheet.clipboard.cutRange;
    if (cut) {
      const cr = this.rangeRect(cut);
      const cs = this.cutMarquee.style;
      cs.display = '';
      cs.left = px(cr.left - 1);
      cs.top = px(cr.top - 1);
      cs.width = px(cr.width + 1);
      cs.height = px(cr.height + 1);
    } else {
      this.cutMarquee.style.display = 'none';
    }

    if (this.drag?.kind === 'fill' && this.drag.target) {
      const fr = this.rangeRect(this.drag.target);
      const fs = this.fillPreview.style;
      fs.display = '';
      fs.left = px(fr.left - 1);
      fs.top = px(fr.top - 1);
      fs.width = px(fr.width + 1);
      fs.height = px(fr.height + 1);
    } else {
      this.fillPreview.style.display = 'none';
    }
  }

  // ---------------------------------------------------------------------------
  // Editor
  // ---------------------------------------------------------------------------

  showEditor(placement: EditorPlacement): void {
    this.editing = placement;
    this.editor.classList.add('cui-editor--open');
    this.positionEditor();
    this.scheduleRender();
  }

  hideEditor(): void {
    this.editing = null;
    this.editor.classList.remove('cui-editor--open');
    this.editor.style.removeProperty('font');
    this.positionEditor();
    this.scheduleRender();
  }

  get isEditorOpen(): boolean {
    return this.editing !== null;
  }

  /** Keep the (hidden) editor near the active cell so that focusing it never scrolls the page. */
  positionEditor(): void {
    const ed = this.editor;
    const s = ed.style;
    if (!this.editing) {
      const rect = this.cellRect(this.sheet.selection.active);
      s.left = px(rect.left);
      s.top = px(rect.top);
      s.width = px(Math.max(1, rect.width));
      s.height = px(Math.max(1, rect.height));
      s.minWidth = '';
      s.minHeight = '';
      return;
    }
    const { address, style } = this.editing;
    const rect = this.cellRect(address);
    s.left = px(rect.left);
    s.top = px(rect.top);
    s.fontFamily = style.fontFamily ?? '';
    s.fontSize = style.fontSize ? `${style.fontSize}pt` : '';
    s.fontWeight = style.bold ? 'bold' : '';
    s.fontStyle = style.italic ? 'italic' : '';
    s.color = style.color ?? '';
    s.background = style.backgroundColor ?? '#fff';
    s.textAlign = style.hAlign ?? defaultAlign(this.sheet.model.getValue(address.row, address.col));
    const wrap = !!style.wrap;
    s.whiteSpace = wrap ? 'pre-wrap' : 'pre';
    const text = ed.value;
    const needed = this.measureText(text, style) + 10;
    const maxWidth = Math.max(rect.width, this.cols.total - rect.left);
    const width = wrap ? rect.width : Math.min(maxWidth, Math.max(rect.width, needed));
    s.width = px(width);
    s.minWidth = px(rect.width);
    const lines = text.split('\n').length;
    const lineHeight = ((style.fontSize ?? 11) * 4) / 3 * 1.3;
    const naturalHeight = wrap ? Math.max(rect.height, ed.scrollHeight) : Math.max(rect.height, lines * lineHeight + 4);
    s.height = px(naturalHeight);
    s.minHeight = px(rect.height);
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  private bindEvents(): void {
    this.viewport.addEventListener('scroll', () => this.scheduleRender(), { passive: true });
    this.viewport.addEventListener('mousedown', (e) => this.onViewportMouseDown(e));
    this.viewport.addEventListener('dblclick', (e) => this.onViewportDblClick(e));
    this.viewport.addEventListener('contextmenu', (e) => this.onContextMenu(e));
    this.colHeader.addEventListener('mousedown', (e) => this.onColHeaderMouseDown(e));
    this.colHeader.addEventListener('dblclick', (e) => this.onColHeaderDblClick(e));
    this.colHeader.addEventListener('mousemove', (e) => this.updateHeaderCursor(e, 'col'));
    this.colHeader.addEventListener('contextmenu', (e) => this.onContextMenu(e));
    this.rowHeader.addEventListener('mousedown', (e) => this.onRowHeaderMouseDown(e));
    this.rowHeader.addEventListener('dblclick', (e) => this.onRowHeaderDblClick(e));
    this.rowHeader.addEventListener('mousemove', (e) => this.updateHeaderCursor(e, 'row'));
    this.rowHeader.addEventListener('contextmenu', (e) => this.onContextMenu(e));
    this.corner.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.sheet.selection.selectAll();
      this.sheet.focus();
    });
    this.fillHandle.addEventListener('mousedown', (e) => this.onFillHandleMouseDown(e));
    window.addEventListener('mousemove', this.onWindowMouseMove);
    window.addEventListener('mouseup', this.onWindowMouseUp);
  }

  unbindWindowEvents(): void {
    window.removeEventListener('mousemove', this.onWindowMouseMove);
    window.removeEventListener('mouseup', this.onWindowMouseUp);
  }

  private onViewportMouseDown(e: MouseEvent): void {
    if (e.button !== 0) return;
    if (e.target === this.editor) return;
    const { x, y } = this.pointerToContent(e);
    if (x > this.cols.total || y > this.rows.total) return;
    e.preventDefault();
    const addr = this.addressAt(x, y);
    if (this.sheet.isEditing) {
      if (sameAddress(addr, this.sheet.selection.active)) return;
      if (!this.sheet.commitEdit()) return;
    }
    if (e.shiftKey) this.sheet.selection.extendTo(addr);
    else this.sheet.selection.setActive(addr);
    this.drag = { kind: 'select' };
    this.startAutoScroll();
    this.sheet.focus();
  }

  private onViewportDblClick(e: MouseEvent): void {
    if (e.target === this.editor) return;
    const { x, y } = this.pointerToContent(e);
    if (x > this.cols.total || y > this.rows.total) return;
    const addr = this.addressAt(x, y);
    this.sheet.selection.setActive(addr);
    this.sheet.startEdit('edit');
  }

  private onContextMenu(e: MouseEvent): void {
    if (e.target === this.editor) return;
    e.preventDefault();
    if (this.sheet.isEditing) this.sheet.commitEdit();
    const target = e.target as HTMLElement;
    const colHeader = target.closest('.cui-header-col') as HTMLElement | null;
    const rowHeader = target.closest('.cui-header-row') as HTMLElement | null;
    const sel = this.sheet.selection;
    if (colHeader) {
      const c = Number(colHeader.dataset.col);
      if (!(sel.mode === 'columns' && c >= sel.range.start.col && c <= sel.range.end.col)) sel.selectColumns(c);
    } else if (rowHeader) {
      const r = Number(rowHeader.dataset.row);
      if (!(sel.mode === 'rows' && r >= sel.range.start.row && r <= sel.range.end.row)) sel.selectRows(r);
    } else {
      const { x, y } = this.pointerToContent(e);
      const addr = this.addressAt(x, y);
      if (!rangeContains(sel.range, addr)) sel.setActive(addr);
    }
    this.sheet.focus();
    this.sheet.contextMenu.show(e.clientX, e.clientY);
  }

  private headerHit(e: MouseEvent, axis: 'col' | 'row'): { index: number; resize: boolean } | null {
    const layout = axis === 'col' ? this.cols : this.rows;
    const wrap = axis === 'col' ? this.colHeader : this.rowHeader;
    const rect = wrap.getBoundingClientRect();
    const pos = axis === 'col' ? e.clientX - rect.left : e.clientY - rect.top;
    if (pos < 0 || pos > layout.total) return null;
    const index = layout.indexAt(pos);
    const end = layout.offset(index + 1);
    const start = layout.offset(index);
    if (pos >= end - RESIZE_ZONE) return { index, resize: true };
    if (pos <= start + RESIZE_ZONE - 2 && index > 0) {
      // Near the left/top edge: resize the previous visible item (also lets hidden items be revealed).
      let prev = index - 1;
      while (prev > 0 && layout.size(prev) === 0) prev--;
      return { index: prev, resize: true };
    }
    return { index, resize: false };
  }

  private updateHeaderCursor(e: MouseEvent, axis: 'col' | 'row'): void {
    if (this.drag) return;
    const hit = this.headerHit(e, axis);
    const wrap = axis === 'col' ? this.colHeader : this.rowHeader;
    wrap.style.cursor = hit?.resize ? (axis === 'col' ? 'col-resize' : 'row-resize') : '';
  }

  private onColHeaderMouseDown(e: MouseEvent): void {
    if (e.button !== 0) return;
    const hit = this.headerHit(e, 'col');
    if (!hit) return;
    e.preventDefault();
    if (this.sheet.isEditing && !this.sheet.commitEdit()) return;
    if (hit.resize) {
      const guide = el('div', 'cui-resize-guide cui-resize-guide-v', this.root);
      guide.style.left = px(this.headerWidth + this.cols.offset(hit.index + 1) - this.viewport.scrollLeft);
      this.drag = { kind: 'resize-col', index: hit.index, startX: e.clientX, startSize: this.cols.size(hit.index), guide };
      return;
    }
    const sel = this.sheet.selection;
    if (e.shiftKey && sel.mode === 'columns') sel.extendTo({ row: 0, col: hit.index });
    else sel.selectColumns(hit.index, hit.index, this.visibleRows[0]);
    this.drag = { kind: 'select-cols' };
    this.startAutoScroll();
    this.sheet.focus();
  }

  private onRowHeaderMouseDown(e: MouseEvent): void {
    if (e.button !== 0) return;
    const hit = this.headerHit(e, 'row');
    if (!hit) return;
    e.preventDefault();
    if (this.sheet.isEditing && !this.sheet.commitEdit()) return;
    if (hit.resize) {
      const guide = el('div', 'cui-resize-guide cui-resize-guide-h', this.root);
      guide.style.top = px(this.headerHeight + this.rows.offset(hit.index + 1) - this.viewport.scrollTop);
      this.drag = { kind: 'resize-row', index: hit.index, startY: e.clientY, startSize: this.rows.size(hit.index), guide };
      return;
    }
    const sel = this.sheet.selection;
    if (e.shiftKey && sel.mode === 'rows') sel.extendTo({ row: hit.index, col: 0 });
    else sel.selectRows(hit.index, hit.index, this.visibleCols[0]);
    this.drag = { kind: 'select-rows' };
    this.startAutoScroll();
    this.sheet.focus();
  }

  private onColHeaderDblClick(e: MouseEvent): void {
    const hit = this.headerHit(e, 'col');
    if (!hit?.resize) return;
    this.sheet.model.setColumnWidth(hit.index, this.autoFitWidth(hit.index));
  }

  private onRowHeaderDblClick(e: MouseEvent): void {
    const hit = this.headerHit(e, 'row');
    if (!hit?.resize) return;
    this.sheet.model.setRowHeight(hit.index, this.autoFitHeight(hit.index));
  }

  private onFillHandleMouseDown(e: MouseEvent): void {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    if (this.sheet.isEditing && !this.sheet.commitEdit()) return;
    this.drag = { kind: 'fill', source: normalizeRange(this.sheet.selection.range), target: null };
    this.startAutoScroll();
  }

  private onWindowMouseMove = (e: MouseEvent): void => {
    this.lastPointer = { x: e.clientX, y: e.clientY };
    if (!this.drag) return;
    this.handleDrag(e.clientX, e.clientY);
  };

  private handleDrag(clientX: number, clientY: number): void {
    const drag = this.drag;
    if (!drag) return;
    const vpRect = this.viewport.getBoundingClientRect();
    const x = Math.max(0, Math.min(this.cols.total - 1, clientX - vpRect.left + this.viewport.scrollLeft));
    const y = Math.max(0, Math.min(this.rows.total - 1, clientY - vpRect.top + this.viewport.scrollTop));
    const sel = this.sheet.selection;
    switch (drag.kind) {
      case 'select':
        sel.extendTo(this.addressAt(x, y));
        break;
      case 'select-cols':
        sel.extendTo({ row: 0, col: this.cols.indexAt(x) });
        break;
      case 'select-rows':
        sel.extendTo({ row: this.rows.indexAt(y), col: 0 });
        break;
      case 'resize-col': {
        const size = Math.max(0, drag.startSize + clientX - drag.startX);
        drag.guide.style.left = px(this.headerWidth + this.cols.offset(drag.index) + size - this.viewport.scrollLeft);
        break;
      }
      case 'resize-row': {
        const size = Math.max(0, drag.startSize + clientY - drag.startY);
        drag.guide.style.top = px(this.headerHeight + this.rows.offset(drag.index) + size - this.viewport.scrollTop);
        break;
      }
      case 'fill': {
        const addr = this.addressAt(x, y);
        drag.target = this.computeFillTarget(drag.source, addr);
        this.scheduleRender();
        break;
      }
    }
  }

  /** Extend the source range towards the pointer along the dominant axis (Excel fill semantics). */
  private computeFillTarget(source: CellRange, pointer: CellAddress): CellRange | null {
    const src = normalizeRange(source);
    const below = pointer.row - src.end.row;
    const above = src.start.row - pointer.row;
    const right = pointer.col - src.end.col;
    const left = src.start.col - pointer.col;
    const dv = Math.max(below, above, 0);
    const dh = Math.max(right, left, 0);
    if (dv === 0 && dh === 0) {
      // Pointer inside the source: shrink (Excel clears cells) – treat as no-op except when pointer is in the source's first row/col.
      return null;
    }
    if (dv >= dh) {
      if (below > 0) return { start: { ...src.start }, end: { row: pointer.row, col: src.end.col } };
      return { start: { row: pointer.row, col: src.start.col }, end: { ...src.end } };
    }
    if (right > 0) return { start: { ...src.start }, end: { row: src.end.row, col: pointer.col } };
    return { start: { row: src.start.row, col: pointer.col }, end: { ...src.end } };
  }

  private onWindowMouseUp = (e: MouseEvent): void => {
    const drag = this.drag;
    if (!drag) return;
    this.drag = null;
    this.stopAutoScroll();
    switch (drag.kind) {
      case 'resize-col': {
        drag.guide.remove();
        const size = Math.max(0, drag.startSize + e.clientX - drag.startX);
        this.applyResize('col', drag.index, size);
        break;
      }
      case 'resize-row': {
        drag.guide.remove();
        const size = Math.max(0, drag.startSize + e.clientY - drag.startY);
        this.applyResize('row', drag.index, size);
        break;
      }
      case 'fill':
        if (drag.target) this.sheet.fillRange(drag.source, drag.target);
        this.scheduleRender();
        break;
      default:
        break;
    }
  };

  /** Resizing a row/column that is part of a full row/column selection resizes the whole selection (like Excel). */
  private applyResize(axis: 'col' | 'row', index: number, size: number): void {
    const sel = this.sheet.selection;
    const range = normalizeRange(sel.range);
    const model = this.sheet.model;
    const inSelection =
      axis === 'col'
        ? (sel.mode === 'columns' || sel.mode === 'all') && index >= range.start.col && index <= range.end.col
        : (sel.mode === 'rows' || sel.mode === 'all') && index >= range.start.row && index <= range.end.row;
    model.transact(axis === 'col' ? 'resizeColumn' : 'resizeRow', () => {
      if (inSelection) {
        if (axis === 'col') for (let c = range.start.col; c <= range.end.col; c++) model.setColumnWidth(c, size);
        else for (let r = range.start.row; r <= range.end.row; r++) model.setRowHeight(r, size);
      } else if (axis === 'col') model.setColumnWidth(index, size);
      else model.setRowHeight(index, size);
    });
  }

  private startAutoScroll(): void {
    this.stopAutoScroll();
    this.autoScrollTimer = window.setInterval(() => {
      if (!this.drag) return;
      const rect = this.viewport.getBoundingClientRect();
      const { x, y } = this.lastPointer;
      let dx = 0;
      let dy = 0;
      if (x < rect.left) dx = -Math.min(60, (rect.left - x) / 2 + 4);
      else if (x > rect.right) dx = Math.min(60, (x - rect.right) / 2 + 4);
      if (y < rect.top) dy = -Math.min(60, (rect.top - y) / 2 + 4);
      else if (y > rect.bottom) dy = Math.min(60, (y - rect.bottom) / 2 + 4);
      if (dx || dy) {
        this.viewport.scrollLeft += dx;
        this.viewport.scrollTop += dy;
        this.handleDrag(x, y);
        this.scheduleRender();
      }
    }, 50);
  }

  private stopAutoScroll(): void {
    if (this.autoScrollTimer !== null) {
      clearInterval(this.autoScrollTimer);
      this.autoScrollTimer = null;
    }
  }

  get fillDragActive(): boolean {
    return this.drag?.kind === 'fill';
  }

  /** Size (in rows/cols) of the given range – convenience for the host. */
  static size(range: CellRange): { rows: number; cols: number } {
    return rangeSize(range);
  }
}
