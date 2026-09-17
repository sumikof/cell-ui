import { SheetModel, type SheetModelOptions, type SheetSnapshot } from './model/sheet';
import type { CellAddress, CellData, CellRange, CellStyle, CellValue } from './model/types';
import { addressToA1, columnLabel, iterateRange, normalizeRange, rangeSize, rangeContains } from './model/address';
import { editableText, formatValue, parseInputValue } from './model/value';
import { Emitter } from './model/emitter';
import { Selection } from './selection';
import { Keymap, isMacPlatform } from './keyboard/keymap';
import { CommandRegistry } from './commands';
import { ClipboardState, buildClipboardPayload, computePasteRange, tileBlock, type ParsedClipboard } from './clipboard';
import { GridView } from './render/grid';
import { Toolbar } from './ui/toolbar';
import { ContextMenu } from './ui/menu';
import { FormulaBar } from './ui/formulabar';
import { StatusBar } from './ui/statusbar';
import { getStrings, type Strings } from './i18n';
import { installDefaultCommands } from './defaults/commands';
import { installDefaultKeymap } from './defaults/keymap';
import { installDefaultToolbar } from './defaults/toolbar';
import { installDefaultContextMenu } from './defaults/menu';
import type { CellRenderer, DisplayResolver, EditTextResolver, SpreadsheetPlugin, ValueParser } from './plugins/api';

export type EditMode = 'enter' | 'edit' | 'formula';

export interface SpreadsheetOptions extends SheetModelOptions {
  /** Show the formatting toolbar (default true). */
  toolbar?: boolean;
  /**
   * Show the formula bar (default true). `false` hides it entirely, leaving
   * only the table. `{ nameBox: false }` keeps the function/cell-content input
   * but hides the A1 name box. Hiding the input (`{ input: false }`) hides the
   * whole bar, name box included, so that only the table remains.
   */
  formulaBar?: boolean | { nameBox?: boolean; input?: boolean };
  /** Show the status bar with selection statistics (default true). */
  statusBar?: boolean;
  /** Enable the right-click context menu (default true). */
  contextMenu?: boolean;
  showGridlines?: boolean;
  /** Show the drag-to-fill handle (default true). */
  fillHandle?: boolean;
  /**
   * Row-number / column-letter headers (default true). `false` hides both;
   * `{ rows: false }` hides only the row numbers, `{ cols: false }` only the
   * column letters. Without headers, rows/columns can still be resized and
   * selected through the API.
   */
  headers?: boolean | { rows?: boolean; cols?: boolean };
  /**
   * Custom column header labels, e.g. `['品名', '数量', '単価']`, used instead of
   * the Excel letters A, B, C…. Only applied to fixed-width sheets
   * (`fitContent: true` or `'width'`), where the column set is a stable part
   * of the layout; on a scrolling sheet it is ignored with a warning. Columns
   * without a label (or beyond the array) fall back to their letter. Cell
   * references (name box, clipboard) keep using letters.
   */
  columnLabels?: (string | undefined)[] | ((col: number) => string | undefined);
  /** Width of the row-header column in px (default 46). */
  rowHeaderWidth?: number;
  /** Height of the column-header row in px (default 22). */
  columnHeaderHeight?: number;
  /** Apply column widths that come with pasted HTML tables when pasting into a single cell (default false). */
  pasteColumnWidths?: boolean;
  /**
   * Size the component to its rows/columns instead of filling the container:
   * `true` fits both width and height, `'height'` / `'width'` fit one axis.
   * Useful for small fixed tables such as 10 rows × 5 columns; the component
   * grows as rows/columns are appended.
   */
  fitContent?: boolean | 'height' | 'width';
  /**
   * Automatically append a row when Enter / ArrowDown is pressed on the last
   * row, and a column when Tab / ArrowRight is pressed on the last column.
   * `true` enables both; an object enables each axis separately.
   */
  autoExpand?: boolean | { rows?: boolean; cols?: boolean };
  /** UI language, e.g. "ja" or "en". Defaults to the browser language. */
  locale?: string;
  /** Initial content. */
  data?: Partial<SheetSnapshot>;
  plugins?: SpreadsheetPlugin[];
  /** Skip the built-in toolbar items / context-menu items / key bindings (for fully custom UIs). */
  defaults?: { toolbar?: boolean; contextMenu?: boolean; keymap?: boolean };
}

export interface SpreadsheetEvents extends Record<string, unknown> {
  editstart: { address: CellAddress; mode: EditMode };
  editcommit: { address: CellAddress; text: string; cell: CellData };
  editcancel: { address: CellAddress };
  copy: { range: CellRange; cut: boolean };
  paste: { range: CellRange; block: CellData[][]; internal: boolean };
  fill: { source: CellRange; target: CellRange };
  destroy: undefined;
}

/** UI parts that can be shown/hidden at runtime with `Spreadsheet.setVisible`. */
export type UiPart = 'toolbar' | 'formulaBar' | 'nameBox' | 'formulaInput' | 'statusBar' | 'contextMenu' | 'rowHeaders' | 'columnHeaders' | 'headers' | 'gridlines' | 'fillHandle';

export interface FillOptions {
  /** Extrapolate numeric/“Item1”-style series (default true, like the fill handle). */
  series?: boolean;
}

const SENTINEL = ' ';

/**
 * Excel-like spreadsheet component.
 *
 * ```ts
 * const sheet = new Spreadsheet(document.getElementById('app')!, { rows: 200, cols: 26 });
 * sheet.model.setValue(0, 0, 'Hello');
 * ```
 */
export class Spreadsheet {
  readonly options: SpreadsheetOptions;
  readonly model: SheetModel;
  readonly selection: Selection;
  readonly keymap: Keymap;
  readonly commands: CommandRegistry<Spreadsheet>;
  readonly clipboard = new ClipboardState();
  readonly events = new Emitter<SpreadsheetEvents>();
  readonly strings: Strings;
  readonly isMac = isMacPlatform();
  readonly root: HTMLElement;
  readonly grid: GridView;
  readonly toolbar: Toolbar;
  readonly contextMenu: ContextMenu;
  readonly formulaBar: FormulaBar;
  readonly statusBar: StatusBar;

  readonly valueParsers: ValueParser[] = [];
  readonly displayResolvers: DisplayResolver[] = [];
  readonly editTextResolvers: EditTextResolver[] = [];
  readonly cellRenderers: CellRenderer[] = [];

  private _editMode: EditMode | null = null;
  private editAddress: CellAddress | null = null;
  private editOriginal = '';
  private tabStartCol: number | null = null;
  private pasteValuesOnlyOnce = false;
  private pluginCleanups = new Map<string, () => void>();
  private destroyed = false;
  private readonly disposers: (() => void)[] = [];

  constructor(container: HTMLElement, options: SpreadsheetOptions = {}) {
    this.options = options;
    this.strings = getStrings(options.locale);
    this.model = new SheetModel(options);
    this.selection = new Selection(() => ({ rows: this.model.rowCount, cols: this.model.colCount }));
    this.keymap = new Keymap(this.isMac);
    this.commands = new CommandRegistry<Spreadsheet>(this);

    this.root = document.createElement('div');
    this.root.className = 'cui-root';
    this.root.tabIndex = -1;
    if (this.isMac) this.root.classList.add('cui-mac');
    this.toolbar = new Toolbar(this);
    this.formulaBar = new FormulaBar(this);
    this.grid = new GridView(this);
    this.statusBar = new StatusBar(this);
    this.contextMenu = new ContextMenu(this);
    if (options.toolbar !== false) this.root.appendChild(this.toolbar.element);
    if (this.formulaBarParts().input) this.root.appendChild(this.formulaBar.element);
    this.root.appendChild(this.grid.root);
    if (options.statusBar !== false) this.root.appendChild(this.statusBar.element);
    container.appendChild(this.root);

    installDefaultCommands(this.commands);
    if (options.defaults?.keymap !== false) installDefaultKeymap(this.keymap);
    if (options.defaults?.toolbar !== false) installDefaultToolbar(this);
    if (options.defaults?.contextMenu !== false) installDefaultContextMenu(this);

    if (options.data) {
      this.model.load(options.data);
      this.model.clearHistory();
    }

    this.bindEvents();
    this.grid.mount();
    this.formulaBar.update();
    this.statusBar.update();
    this.toolbar.refresh();
    this.grid.editor.value = SENTINEL;

    for (const plugin of options.plugins ?? []) this.use(plugin);
  }

  // ---------------------------------------------------------------------------
  // Plugins & hooks
  // ---------------------------------------------------------------------------

  use(plugin: SpreadsheetPlugin): this {
    this.pluginCleanups.get(plugin.name)?.();
    const cleanup = plugin.install(this);
    this.pluginCleanups.set(plugin.name, typeof cleanup === 'function' ? cleanup : () => {});
    this.refreshAll();
    return this;
  }

  removePlugin(name: string): void {
    this.pluginCleanups.get(name)?.();
    this.pluginCleanups.delete(name);
    this.refreshAll();
  }

  addValueParser(parser: ValueParser): () => void {
    this.valueParsers.unshift(parser);
    return () => this.removeFrom(this.valueParsers, parser);
  }

  addDisplayResolver(resolver: DisplayResolver): () => void {
    this.displayResolvers.unshift(resolver);
    this.grid.scheduleRender();
    return () => this.removeFrom(this.displayResolvers, resolver);
  }

  addEditTextResolver(resolver: EditTextResolver): () => void {
    this.editTextResolvers.unshift(resolver);
    return () => this.removeFrom(this.editTextResolvers, resolver);
  }

  addCellRenderer(renderer: CellRenderer): () => void {
    this.cellRenderers.push(renderer);
    this.grid.scheduleRender();
    return () => this.removeFrom(this.cellRenderers, renderer);
  }

  private removeFrom<T>(list: T[], item: T): void {
    const i = list.indexOf(item);
    if (i >= 0) list.splice(i, 1);
    this.grid.scheduleRender();
  }

  /** Text displayed in a cell (and placed on the clipboard as plain text). */
  displayText(address: CellAddress, cell: CellData | undefined = this.model.getCell(address.row, address.col)): string {
    for (const resolver of this.displayResolvers) {
      const r = resolver(cell, address, this);
      if (r !== undefined) return r;
    }
    return formatValue(cell?.value ?? null);
  }

  /** Text shown in the editor for a cell. */
  editText(address: CellAddress): string {
    const cell = this.model.getCell(address.row, address.col);
    for (const resolver of this.editTextResolvers) {
      const r = resolver(cell, address, this);
      if (r !== undefined) return r;
    }
    return editableText(cell);
  }

  /** Convert entered text into cell data (style of the existing cell is preserved). */
  parseInput(text: string, address: CellAddress): CellData {
    const prev = this.model.getCell(address.row, address.col);
    let result: CellData | CellValue | undefined;
    for (const parser of this.valueParsers) {
      result = parser(text, address, this);
      if (result !== undefined) break;
    }
    if (result === undefined) result = parseInputValue(text);
    const data: CellData = result !== null && typeof result === 'object' ? { ...result } : { value: result };
    if (data.style === undefined) data.style = prev?.style;
    return data;
  }

  // ---------------------------------------------------------------------------
  // Focus & editing
  // ---------------------------------------------------------------------------

  get isEditing(): boolean {
    return this._editMode !== null;
  }

  get editMode(): EditMode | null {
    return this._editMode;
  }

  get editorText(): string {
    return this.isEditing ? this.grid.editor.value : '';
  }

  focus(): void {
    if (this.destroyed) return;
    const ed = this.grid.editor;
    if (this._editMode === 'formula') {
      this.formulaBar.input.focus({ preventScroll: true });
      return;
    }
    ed.focus({ preventScroll: true });
    if (!this.isEditing) this.armSentinel();
  }

  get hasFocus(): boolean {
    return this.root.contains(this.activeElement);
  }

  /** The focused element, looking inside a Shadow DOM when the sheet lives in one. */
  get activeElement(): Element | null {
    const rootNode = this.root.getRootNode() as Document | ShadowRoot;
    return ('activeElement' in rootNode ? rootNode.activeElement : null) ?? document.activeElement;
  }

  /**
   * Where floating UI (context menu, colour picker, popovers) is appended.
   * Defaults to `document.body`, or to the shadow root when embedded via the
   * `<cell-ui-sheet>` custom element so that styles keep applying.
   */
  get popoverHost(): HTMLElement | ShadowRoot {
    const rootNode = this.root.getRootNode();
    if (rootNode instanceof ShadowRoot) return rootNode;
    return document.body;
  }

  private armSentinel(): void {
    const ed = this.grid.editor;
    if (ed.value !== SENTINEL) ed.value = SENTINEL;
    try {
      ed.setSelectionRange(0, ed.value.length);
    } catch {
      /* ignore */
    }
  }

  /**
   * Open the editor on the active cell.
   *  - `enter`: started by typing; arrows commit and move
   *  - `edit`: F2 / double-click; arrows move the caret
   *  - `formula`: typing in the formula bar
   */
  startEdit(mode: EditMode = 'edit', initialText?: string): void {
    if (this.destroyed) return;
    if (this.isEditing) {
      this.setEditMode(mode);
      return;
    }
    const address = { ...this.selection.active };
    if (this.model.getRowHeight(address.row) === 0 || this.model.getColumnWidth(address.col) === 0) return;
    const text = initialText !== undefined ? initialText : mode === 'enter' ? '' : this.editText(address);
    this._editMode = mode;
    this.editAddress = address;
    this.editOriginal = this.editText(address);
    const ed = this.grid.editor;
    ed.value = text;
    this.grid.scrollIntoView(address);
    this.grid.showEditor({ address, style: this.model.getEffectiveStyle(address.row, address.col) });
    if (mode === 'formula') {
      this.formulaBar.input.value = text;
    } else {
      ed.focus({ preventScroll: true });
      ed.setSelectionRange(text.length, text.length);
    }
    this.root.classList.add('cui-root--editing');
    this.formulaBar.update();
    this.events.emit('editstart', { address, mode });
  }

  setEditMode(mode: EditMode): void {
    if (!this.isEditing || this._editMode === mode) return;
    this._editMode = mode;
    if (mode === 'formula') this.formulaBar.input.value = this.grid.editor.value;
    else this.grid.editor.focus({ preventScroll: true });
  }

  toggleEditMode(): void {
    if (!this.isEditing) return;
    this._editMode = this._editMode === 'enter' ? 'edit' : 'enter';
  }

  /** Replace the editor text (used by the formula bar and plugins). */
  setEditorText(text: string, options: { fromFormulaBar?: boolean } = {}): void {
    if (!this.isEditing) return;
    const ed = this.grid.editor;
    ed.value = text;
    if (!options.fromFormulaBar && this.formulaBar.input !== this.activeElement) this.formulaBar.input.value = text;
    this.grid.positionEditor();
  }

  insertEditorText(text: string): void {
    if (!this.isEditing) return;
    const target = this._editMode === 'formula' ? this.formulaBar.input : this.grid.editor;
    const { selectionStart, selectionEnd, value } = target;
    target.value = value.slice(0, selectionStart) + text + value.slice(selectionEnd);
    target.selectionStart = target.selectionEnd = selectionStart + text.length;
    this.setEditorText(target.value, { fromFormulaBar: this._editMode === 'formula' });
    this.formulaBar.update();
  }

  /** Commit the editor. Returns false when editing was not active. */
  commitEdit(options: { fillSelection?: boolean } = {}): boolean {
    if (!this.isEditing || !this.editAddress) return false;
    const address = this.editAddress;
    const text = this._editMode === 'formula' ? this.formulaBar.input.value : this.grid.editor.value;
    const wasEnterMode = this._editMode === 'enter';
    this.closeEditor();
    if (text !== this.editOriginal || options.fillSelection) {
      const cell = this.parseInput(text, address);
      if (options.fillSelection && !this.selection.isSingleCell) {
        this.model.transact('enter', () => {
          for (const addr of iterateRange(this.selection.range)) {
            const parsed = this.parseInput(text, addr);
            this.model.setCell(addr.row, addr.col, parsed);
          }
        });
      } else {
        this.model.transact('enter', () => this.model.setCell(address.row, address.col, cell));
      }
      this.events.emit('editcommit', { address, text, cell });
    }
    if (!wasEnterMode) this.tabStartCol = null;
    this.refreshAll();
    return true;
  }

  cancelEdit(): void {
    if (!this.isEditing || !this.editAddress) return;
    const address = this.editAddress;
    this.closeEditor();
    this.events.emit('editcancel', { address });
    this.refreshAll();
  }

  private closeEditor(): void {
    this._editMode = null;
    this.editAddress = null;
    this.grid.hideEditor();
    this.root.classList.remove('cui-root--editing');
    this.grid.editor.focus({ preventScroll: true });
    this.armSentinel();
  }

  /** Programmatically enter text into the active cell as if typed and committed. */
  enterText(text: string): void {
    if (this.isEditing) {
      this.insertEditorText(text);
      return;
    }
    const a = this.selection.active;
    this.model.transact('enter', () => this.model.setCell(a.row, a.col, this.parseInput(text, a)));
  }

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  goTo(address: CellAddress, extend = false): void {
    if (this.isEditing && !this.commitEdit()) return;
    if (extend) this.selection.extendTo(address);
    else this.selection.setActive(address);
    this.tabStartCol = null;
    this.grid.scrollIntoView(extend ? address : this.selection.active);
  }

  /**
   * Show or hide a UI part after construction. Equivalent to the matching
   * constructor option (`toolbar`, `formulaBar`, `statusBar`, `contextMenu`,
   * `headers`, `showGridlines`, `fillHandle`).
   */
  setVisible(part: UiPart, visible: boolean): void {
    const o = this.options;
    switch (part) {
      case 'toolbar':
        o.toolbar = visible;
        this.mountPanel(this.toolbar.element, visible, 0);
        break;
      case 'formulaBar':
        o.formulaBar = visible;
        this.mountPanel(this.formulaBar.element, visible, o.toolbar === false ? 0 : 1);
        this.formulaBar.applyOptions();
        break;
      case 'formulaInput':
        // The name box never shows on its own: hiding the input hides the bar.
        o.formulaBar = visible;
        this.mountPanel(this.formulaBar.element, visible, o.toolbar === false ? 0 : 1);
        this.formulaBar.applyOptions();
        break;
      case 'nameBox': {
        const parts = this.formulaBarParts();
        o.formulaBar = visible ? (parts.input ? true : { nameBox: true, input: false }) : parts.input ? { nameBox: false } : false;
        if (o.formulaBar && typeof o.formulaBar === 'object' && o.formulaBar.input === false) o.formulaBar = false;
        this.mountPanel(this.formulaBar.element, o.formulaBar !== false, o.toolbar === false ? 0 : 1);
        this.formulaBar.applyOptions();
        break;
      }
      case 'statusBar':
        o.statusBar = visible;
        this.mountPanel(this.statusBar.element, visible, this.root.children.length);
        break;
      case 'contextMenu':
        o.contextMenu = visible;
        if (!visible) this.contextMenu.hide();
        break;
      case 'headers':
        o.headers = visible;
        break;
      case 'rowHeaders':
      case 'columnHeaders': {
        const h = o.headers;
        const cur = { rows: h === undefined || h === true || (typeof h === 'object' && h.rows !== false), cols: h === undefined || h === true || (typeof h === 'object' && h.cols !== false) };
        if (part === 'rowHeaders') cur.rows = visible;
        else cur.cols = visible;
        o.headers = cur.rows && cur.cols ? true : { rows: cur.rows, cols: cur.cols };
        break;
      }
      case 'gridlines':
        o.showGridlines = visible;
        break;
      case 'fillHandle':
        o.fillHandle = visible;
        break;
    }
    this.grid.applyLayoutOptions();
    this.refreshAll();
  }

  isVisible(part: UiPart): boolean {
    const o = this.options;
    const h = o.headers;
    switch (part) {
      case 'toolbar': return o.toolbar !== false;
      case 'formulaBar': return this.formulaBarParts().input;
      case 'nameBox': return this.formulaBarParts().nameBox;
      case 'formulaInput': return this.formulaBarParts().input;
      case 'statusBar': return o.statusBar !== false;
      case 'contextMenu': return o.contextMenu !== false;
      case 'gridlines': return o.showGridlines !== false;
      case 'fillHandle': return o.fillHandle !== false;
      case 'rowHeaders': return this.grid.headerWidth > 0;
      case 'columnHeaders': return this.grid.headerHeight > 0;
      case 'headers': return h !== false && this.grid.headerWidth > 0 && this.grid.headerHeight > 0;
    }
  }

  /** Which parts of the formula bar are enabled by the current options. */
  formulaBarParts(): { nameBox: boolean; input: boolean } {
    const f = this.options.formulaBar;
    if (f === false) return { nameBox: false, input: false };
    if (f === undefined || f === true) return { nameBox: true, input: true };
    // Without the input there is nothing to show but the cell address, so the whole bar goes.
    if (f.input === false) return { nameBox: false, input: false };
    return { nameBox: f.nameBox !== false, input: true };
  }

  /** Whether the sheet's width is fixed to its columns (`fitContent: true | 'width'`). */
  get isFixedWidth(): boolean {
    const f = this.options.fitContent;
    return f === true || f === 'width';
  }

  private warnedColumnLabels = false;

  /** Header label for a column: custom label on fixed-width sheets, otherwise the Excel letter. */
  columnLabel(col: number): string {
    const labels = this.options.columnLabels;
    if (labels) {
      if (this.isFixedWidth) {
        const label = typeof labels === 'function' ? labels(col) : labels[col];
        if (label !== undefined && label !== null && label !== '') return label;
      } else if (!this.warnedColumnLabels) {
        this.warnedColumnLabels = true;
        console.warn('[cell-ui] columnLabels is only applied to fixed-width sheets (fitContent: true or "width").');
      }
    }
    return columnLabel(col);
  }

  /** Replace the custom column labels at runtime (fixed-width sheets only). */
  setColumnLabels(labels: SpreadsheetOptions['columnLabels']): void {
    this.options.columnLabels = labels;
    this.warnedColumnLabels = false;
    this.grid.scheduleRender();
  }

  private mountPanel(element: HTMLElement, visible: boolean, index: number): void {
    if (!visible) {
      element.remove();
      return;
    }
    if (element.parentElement === this.root) return;
    const ref = this.root.children[Math.min(index, this.root.children.length)] ?? null;
    this.root.insertBefore(element, ref);
  }

  /** Append rows at the bottom (keeps the selection, re-renders). */
  appendRows(count = 1): void {
    if (count <= 0) return;
    this.model.appendRows(count);
  }

  /** Append columns at the right. */
  appendColumns(count = 1): void {
    if (count <= 0) return;
    this.model.appendColumns(count);
  }

  private autoExpandEnabled(axis: 'rows' | 'cols'): boolean {
    const o = this.options.autoExpand;
    if (!o) return false;
    if (o === true) return true;
    return !!o[axis];
  }

  /** Grow the sheet when moving past its last row/column and `autoExpand` allows it. Returns true when it grew. */
  private maybeExpandFor(from: CellAddress, dRow: number, dCol: number): boolean {
    let grew = false;
    if (dRow > 0 && from.row === this.model.rowCount - 1 && this.autoExpandEnabled('rows')) {
      this.model.appendRows(1);
      grew = true;
    }
    if (dCol > 0 && from.col === this.model.colCount - 1 && this.autoExpandEnabled('cols')) {
      this.model.appendColumns(1);
      grew = true;
    }
    return grew;
  }

  /** Move the active cell (or extend the selection). `jump` implements Ctrl+Arrow. */
  moveActive(dRow: number, dCol: number, options: { extend?: boolean; jump?: boolean }): void {
    if (this.isEditing && !this.commitEdit()) return;
    const sel = this.selection;
    if (!options.extend && !options.jump) this.maybeExpandFor(sel.active, dRow, dCol);
    const rows = this.model.rowCount;
    const cols = this.model.colCount;
    if (options.extend) {
      const r = normalizeRange(sel.range);
      const a = sel.anchor;
      const corner: CellAddress = {
        row: a.row === r.start.row ? r.end.row : r.start.row,
        col: a.col === r.start.col ? r.end.col : r.start.col,
      };
      const next = options.jump ? this.jumpTarget(corner, dRow, dCol) : this.stepVisible(corner, dRow, dCol);
      sel.extendTo(next);
      this.grid.scrollIntoView(next);
    } else {
      const from = sel.active;
      const next = options.jump ? this.jumpTarget(from, dRow, dCol) : this.stepVisible(from, dRow, dCol);
      sel.setActive({ row: Math.max(0, Math.min(rows - 1, next.row)), col: Math.max(0, Math.min(cols - 1, next.col)) });
      this.grid.scrollIntoView(sel.active);
    }
    this.tabStartCol = null;
  }

  /** Step by (dRow, dCol) skipping hidden rows/columns. */
  private stepVisible(from: CellAddress, dRow: number, dCol: number): CellAddress {
    const rows = this.model.rowCount;
    const cols = this.model.colCount;
    let row = from.row;
    let col = from.col;
    if (dRow) {
      const step = Math.sign(dRow);
      let remaining = Math.abs(dRow);
      while (remaining > 0) {
        const next = row + step;
        if (next < 0 || next >= rows) break;
        row = next;
        if (this.model.getRowHeight(row) > 0) remaining--;
      }
      while (this.model.getRowHeight(row) === 0 && row - step >= 0 && row - step < rows) row -= step;
    }
    if (dCol) {
      const step = Math.sign(dCol);
      let remaining = Math.abs(dCol);
      while (remaining > 0) {
        const next = col + step;
        if (next < 0 || next >= cols) break;
        col = next;
        if (this.model.getColumnWidth(col) > 0) remaining--;
      }
      while (this.model.getColumnWidth(col) === 0 && col - step >= 0 && col - step < cols) col -= step;
    }
    return { row, col };
  }

  /** Excel's Ctrl+Arrow: jump to the edge of the current data block, or to the next block. */
  jumpTarget(from: CellAddress, dRow: number, dCol: number): CellAddress {
    const model = this.model;
    const rows = model.rowCount;
    const cols = model.colCount;
    const stepR = Math.sign(dRow);
    const stepC = Math.sign(dCol);
    const inBounds = (r: number, c: number) => r >= 0 && r < rows && c >= 0 && c < cols;
    let r = from.row;
    let c = from.col;
    const has = (rr: number, cc: number) => inBounds(rr, cc) && model.hasContent(rr, cc);
    const nr = r + stepR;
    const nc = c + stepC;
    if (!inBounds(nr, nc)) return from;
    if (has(r, c) && has(nr, nc)) {
      // Move to the last non-empty cell of the contiguous block.
      while (has(r + stepR, c + stepC)) {
        r += stepR;
        c += stepC;
      }
      return { row: r, col: c };
    }
    // Move to the next non-empty cell, or the edge.
    r += stepR;
    c += stepC;
    while (inBounds(r, c) && !model.hasContent(r, c)) {
      r += stepR;
      c += stepC;
    }
    if (!inBounds(r, c)) {
      return { row: stepR ? (stepR > 0 ? rows - 1 : 0) : from.row, col: stepC ? (stepC > 0 ? cols - 1 : 0) : from.col };
    }
    return { row: r, col: c };
  }

  /** Tab / Shift+Tab. */
  tabMove(direction: 1 | -1): void {
    if (this.isEditing && !this.commitEdit()) return;
    const sel = this.selection;
    if (!sel.isSingleCell) {
      sel.moveActiveWithin(0, direction);
      this.grid.scrollIntoView(sel.active);
      return;
    }
    if (this.tabStartCol === null) this.tabStartCol = sel.active.col;
    this.maybeExpandFor(sel.active, 0, direction);
    const next = this.stepVisible(sel.active, 0, direction);
    sel.setActive(next);
    this.grid.scrollIntoView(sel.active);
  }

  /** Enter / Shift+Enter. After a run of Tabs, Enter returns to the column where tabbing started. */
  enterMove(direction: 1 | -1): void {
    if (this.isEditing && !this.commitEdit()) return;
    const sel = this.selection;
    if (!sel.isSingleCell) {
      sel.moveActiveWithin(direction, 0);
      this.grid.scrollIntoView(sel.active);
      return;
    }
    const col = this.tabStartCol !== null && direction === 1 ? this.tabStartCol : sel.active.col;
    this.maybeExpandFor(sel.active, direction, 0);
    const next = this.stepVisible({ row: sel.active.row, col }, direction, 0);
    sel.setActive(next);
    this.tabStartCol = null;
    this.grid.scrollIntoView(sel.active);
  }

  // ---------------------------------------------------------------------------
  // Formatting
  // ---------------------------------------------------------------------------

  applyStyle(patch: Partial<CellStyle>): void {
    if (this.isEditing && this._editMode !== 'formula') this.commitEdit();
    const range = this.selection.range;
    const { rows, cols } = rangeSize(range);
    if (rows * cols > 1_000_000) return;
    this.model.applyStyle(range, patch);
    this.toolbar.refresh();
  }

  toggleStyle(key: 'bold' | 'italic' | 'underline' | 'strikethrough' | 'wrap'): void {
    const a = this.selection.active;
    const current = !!this.model.getEffectiveStyle(a.row, a.col)[key];
    this.applyStyle({ [key]: current ? undefined : true });
  }

  // ---------------------------------------------------------------------------
  // Clipboard
  // ---------------------------------------------------------------------------

  /**
   * Copy (or cut) the selection. When invoked from a keyboard shortcut we let
   * the browser fire its native `copy`/`cut` event (handled in `onNativeCopy`)
   * so that the clipboard is written without needing extra permissions.
   */
  copyToClipboard(cut: boolean, event?: Event): boolean | Promise<boolean> {
    if (this.isEditing) return false;
    if (event instanceof KeyboardEvent) return false; // native ClipboardEvent follows
    const payload = buildClipboardPayload(this.model, this.selection.range, (cell, r, c) => this.displayText({ row: r, col: c }, cell));
    this.clipboard.remember(payload, cut);
    this.grid.scheduleRender();
    this.events.emit('copy', { range: payload.range, cut });
    const nav = typeof navigator !== 'undefined' ? navigator : undefined;
    if (nav?.clipboard && typeof ClipboardItem !== 'undefined' && nav.clipboard.write) {
      const item = new ClipboardItem({
        'text/plain': new Blob([payload.text], { type: 'text/plain' }),
        'text/html': new Blob([payload.html], { type: 'text/html' }),
      });
      return nav.clipboard
        .write([item])
        .then(() => true)
        .catch(() => this.execCopyFallback(cut));
    }
    return this.execCopyFallback(cut);
  }

  private execCopyFallback(cut: boolean): boolean {
    try {
      this.focus();
      return document.execCommand(cut ? 'cut' : 'copy');
    } catch {
      return false;
    }
  }

  /** Native copy/cut event on the grid (not while editing). */
  private onNativeCopy(e: ClipboardEvent, cut: boolean): void {
    if (this.isEditing) return;
    e.preventDefault();
    const payload = buildClipboardPayload(this.model, this.selection.range, (cell, r, c) => this.displayText({ row: r, col: c }, cell));
    this.clipboard.remember(payload, cut);
    e.clipboardData?.setData('text/plain', payload.text);
    e.clipboardData?.setData('text/html', payload.html);
    this.grid.scheduleRender();
    this.events.emit('copy', { range: payload.range, cut });
  }

  /**
   * Paste. From a keyboard shortcut the native `paste` event does the work;
   * from a menu/button we use the async clipboard API where available.
   */
  pasteFromClipboard(options: { valuesOnly?: boolean; event?: Event } = {}): boolean | Promise<boolean> {
    if (this.isEditing) return false;
    if (options.event instanceof KeyboardEvent) {
      this.pasteValuesOnlyOnce = !!options.valuesOnly;
      return false; // native ClipboardEvent follows
    }
    const nav = typeof navigator !== 'undefined' ? navigator : undefined;
    if (nav?.clipboard?.read) {
      return nav.clipboard
        .read()
        .then(async (items) => {
          let html = '';
          let text = '';
          for (const item of items) {
            if (item.types.includes('text/html')) html = await (await item.getType('text/html')).text();
            if (item.types.includes('text/plain')) text = await (await item.getType('text/plain')).text();
          }
          return this.pasteData({ html, text }, options);
        })
        .catch(async () => {
          // Fall back to plain text (Firefox), then to the in-app payload.
          try {
            const text = await nav.clipboard.readText();
            return this.pasteData({ text }, options);
          } catch {
            const last = this.clipboard.lastPayload;
            return last ? this.pasteData({ text: last.text, html: last.html }, options) : false;
          }
        });
    }
    const last = this.clipboard.lastPayload;
    return last ? this.pasteData({ text: last.text, html: last.html }, options) : false;
  }

  private onNativePaste(e: ClipboardEvent): void {
    if (this.isEditing) return;
    e.preventDefault();
    const valuesOnly = this.pasteValuesOnlyOnce;
    this.pasteValuesOnlyOnce = false;
    const html = e.clipboardData?.getData('text/html') ?? '';
    const text = e.clipboardData?.getData('text/plain') ?? '';
    this.pasteData({ html, text }, { valuesOnly });
  }

  /** Paste raw clipboard data (HTML table, TSV or the in-app payload) at the selection. */
  pasteData(data: { html?: string | null; text?: string | null }, options: { valuesOnly?: boolean } = {}): boolean {
    const parsed = this.clipboard.parse(data, { valuesOnly: options.valuesOnly });
    if (!parsed) return false;
    return this.pasteBlock(parsed);
  }

  pasteBlock(parsed: ParsedClipboard): boolean {
    const block = parsed.block;
    if (!block.length) return false;
    const blockRows = block.length;
    const blockCols = Math.max(1, ...block.map((r) => r.length));
    const target = computePasteRange(this.selection.range, blockRows, blockCols);
    const tiled = tileBlock(block, target);
    if (parsed.plainText) {
      tiled.forEach((row, r) => row.forEach((cell, c) => {
        const addr = { row: target.start.row + r, col: target.start.col + c };
        const data = this.parseInput(String(cell.value ?? ''), addr);
        row[c] = { value: data.value, meta: data.meta, style: this.model.getCell(addr.row, addr.col)?.style };
      }));
    }
    const cut = parsed.internal ? this.clipboard.cutRange : null;
    this.model.transact('paste', () => {
      this.model.ensureSize(target.end.row + 1, target.end.col + 1);
      if (cut) {
        this.model.clearRange(cut, { values: true, styles: true, meta: true });
      }
      this.model.setCells(target.start, tiled);
      if (parsed.columnWidths && rangeSize(this.selection.range).rows === 1 && rangeSize(this.selection.range).cols === 1 && this.options.pasteColumnWidths) {
        parsed.columnWidths.forEach((w, i) => {
          if (w) this.model.setColumnWidth(target.start.col + i, w);
        });
      }
    });
    if (cut) {
      this.clipboard.clearCut();
      this.clipboard.remember({ ...this.clipboard.lastPayload!, block: tiled, range: target }, false);
    }
    this.grid.invalidateLayout();
    this.selection.selectRange(target, target.start);
    this.grid.scrollIntoView(target.start);
    this.events.emit('paste', { range: target, block: tiled, internal: parsed.internal });
    return true;
  }

  // ---------------------------------------------------------------------------
  // Fill
  // ---------------------------------------------------------------------------

  /** Fill `target` (which contains `source`) by repeating/extrapolating the source cells. */
  fillRange(source: CellRange, target: CellRange, options: FillOptions = {}): void {
    const src = normalizeRange(source);
    const tgt = normalizeRange(target);
    const series = options.series !== false;
    const model = this.model;
    const srcCells = model.getCells(src);
    const vertical = tgt.end.row > src.end.row || tgt.start.row < src.start.row;
    const forward = vertical ? tgt.end.row > src.end.row : tgt.end.col > src.end.col;
    model.transact('fill', () => {
      model.ensureSize(tgt.end.row + 1, tgt.end.col + 1);
      if (vertical) {
        for (let c = src.start.col; c <= src.end.col; c++) {
          const pattern = srcCells.map((row) => row[c - src.start.col]);
          const lines = forward ? { from: src.end.row + 1, to: tgt.end.row } : { from: src.start.row - 1, to: tgt.start.row };
          this.fillLine(pattern, series, forward, lines.from, lines.to, (i, cell) => model.setCell(i, c, cell));
        }
      } else {
        for (let r = src.start.row; r <= src.end.row; r++) {
          const pattern = srcCells[r - src.start.row];
          const lines = forward ? { from: src.end.col + 1, to: tgt.end.col } : { from: src.start.col - 1, to: tgt.start.col };
          this.fillLine(pattern, series, forward, lines.from, lines.to, (i, cell) => model.setCell(r, i, cell));
        }
      }
    });
    this.selection.selectRange(tgt, this.selection.active);
    this.events.emit('fill', { source: src, target: tgt });
  }

  private fillLine(pattern: CellData[], series: boolean, forward: boolean, from: number, to: number, write: (index: number, cell: CellData) => void): void {
    const n = pattern.length;
    if (n === 0) return;
    const step = forward ? 1 : -1;
    const values = pattern.map((c) => c.value);
    const allNumbers = values.every((v) => typeof v === 'number');
    let numericStep: number | null = null;
    if (series && allNumbers && n >= 2) {
      const nums = values as number[];
      const d = nums[1] - nums[0];
      if (nums.every((v, i) => i === 0 || Math.abs(v - nums[i - 1] - d) < 1e-9)) numericStep = d;
      else {
        // Linear trend (least squares), as Excel does for non-arithmetic sequences.
        const xs = nums.map((_, i) => i);
        const mx = xs.reduce((a, b) => a + b, 0) / n;
        const my = nums.reduce((a, b) => a + b, 0) / n;
        const den = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
        numericStep = den === 0 ? 0 : xs.reduce((a, x, i) => a + (x - mx) * (nums[i] - my), 0) / den;
      }
    }
    const textSeries = series && n === 1 && typeof values[0] === 'string' ? /^(.*?)(\d+)$/.exec(values[0] as string) : null;
    let k = 0;
    for (let i = from; forward ? i <= to : i >= to; i += step) {
      k++;
      const patIndex = forward ? (k - 1) % n : (n - (k % n)) % n;
      const base = pattern[patIndex];
      let value: CellValue = base.value;
      if (numericStep !== null) {
        const anchor = forward ? (values[n - 1] as number) : (values[0] as number);
        value = anchor + numericStep * k * (forward ? 1 : -1);
        value = Math.round(value * 1e10) / 1e10;
      } else if (textSeries) {
        const num = parseInt(textSeries[2], 10) + k * (forward ? 1 : -1);
        value = `${textSeries[1]}${String(Math.max(0, num)).padStart(textSeries[2].length, '0')}`;
      }
      write(i, { value, style: base.style ? { ...base.style } : undefined, meta: base.meta ? { ...base.meta } : undefined });
    }
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  private bindEvents(): void {
    const ed = this.grid.editor;
    ed.addEventListener('keydown', (e) => this.onKeyDown(e));
    ed.addEventListener('input', () => this.onEditorInput());
    ed.addEventListener('copy', (e) => this.onNativeCopy(e, false));
    ed.addEventListener('cut', (e) => this.onNativeCopy(e, true));
    ed.addEventListener('paste', (e) => this.onNativePaste(e));
    ed.addEventListener('focus', () => {
      this.root.classList.add('cui-root--focused');
      if (!this.isEditing) this.armSentinel();
    });
    ed.addEventListener('blur', (e) => {
      this.root.classList.remove('cui-root--focused');
      const to = (e as FocusEvent).relatedTarget as Node | null;
      if (this.isEditing && this._editMode !== 'formula' && !(to && this.root.contains(to))) this.commitEdit();
    });
    ed.addEventListener('mousedown', (e) => {
      if (!this.isEditing) e.preventDefault();
    });

    this.disposers.push(
      this.model.events.on('change', (ev) => {
        if (ev.structural || ev.sizes) this.grid.invalidateLayout();
        if (ev.structural) this.selection.revalidate();
        this.refreshAll();
      }),
      this.selection.events.on('change', () => {
        this.tabStartColGuard();
        this.grid.scheduleRender();
        this.formulaBar.update();
        this.statusBar.update();
        this.toolbar.refresh();
      }),
    );
  }

  private lastSelectionForTab: CellAddress | null = null;
  private tabStartColGuard(): void {
    // Any selection change that isn't caused by Tab clears the Tab→Enter column memory.
    const a = this.selection.active;
    if (this.lastSelectionForTab && this.tabStartCol !== null && a.row !== this.lastSelectionForTab.row) this.tabStartCol = null;
    this.lastSelectionForTab = { ...a };
  }

  private refreshAll(): void {
    if (this.destroyed) return;
    this.grid.scheduleRender();
    this.formulaBar.update();
    this.statusBar.update();
    this.toolbar.refresh();
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.isComposing || e.keyCode === 229) return;
    const context = this.isEditing ? 'edit' : 'grid';
    const binding = this.keymap.resolve(e, context);
    if (binding) {
      const result = this.commands.execute(binding.command, { args: binding.args, event: e });
      if (result !== false) {
        e.preventDefault();
        if (!this.isEditing) this.armSentinel();
        return;
      }
    }
    if (!this.isEditing) {
      // Printable characters start editing through the `input` event; everything else is swallowed.
      const printable = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
      if (!printable && e.key !== 'Process' && e.key !== 'Dead' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
      }
    }
  }

  private onEditorInput(): void {
    const ed = this.grid.editor;
    if (!this.isEditing) {
      const text = ed.value;
      if (text === SENTINEL) {
        // Nothing actually typed (or only whitespace replaced): keep it simple and start editing with a space.
        this.startEdit('enter', ' ');
        return;
      }
      this.startEdit('enter', text);
      return;
    }
    this.grid.positionEditor();
    if (this._editMode !== 'formula') this.formulaBar.update();
  }

  // ---------------------------------------------------------------------------
  // Misc
  // ---------------------------------------------------------------------------

  /** A1 reference of the active cell. */
  get activeRef(): string {
    return addressToA1(this.selection.active);
  }

  /** Whether `addr` is inside the current selection. */
  isSelected(addr: CellAddress): boolean {
    return rangeContains(this.selection.range, addr);
  }

  /** Load a snapshot (replaces content, keeps undo history as one step). */
  load(data: Partial<SheetSnapshot>): void {
    if (this.isEditing) this.cancelEdit();
    this.model.load(data);
    this.grid.invalidateLayout();
    this.selection.revalidate();
    this.refreshAll();
  }

  toJSON(): SheetSnapshot {
    return this.model.toJSON();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.events.emit('destroy', undefined);
    for (const cleanup of this.pluginCleanups.values()) cleanup();
    this.pluginCleanups.clear();
    for (const d of this.disposers) d();
    this.grid.unbindWindowEvents();
    this.grid.destroy();
    this.toolbar.destroy();
    this.contextMenu.destroy();
    this.formulaBar.destroy();
    this.statusBar.destroy();
    this.root.remove();
    this.events.removeAll();
    this.model.events.removeAll();
    this.selection.events.removeAll();
  }
}

