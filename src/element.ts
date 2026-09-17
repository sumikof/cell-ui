import { Spreadsheet, type SpreadsheetOptions } from './spreadsheet';
import type { SheetSnapshot } from './model/sheet';
import cssText from './styles.css?inline';

export const CELL_UI_CSS: string = cssText;

/**
 * Inject the component stylesheet into a document or shadow root once.
 * Useful when the CSS file cannot be linked (e.g. inside a Shadow DOM).
 */
export function injectStyles(target: Document | ShadowRoot = document): void {
  const marker = 'data-cell-ui-styles';
  const parent: ParentNode = target instanceof Document ? target.head : target;
  if (parent.querySelector(`style[${marker}]`)) return;
  const style = document.createElement('style');
  style.setAttribute(marker, '');
  style.textContent = CELL_UI_CSS;
  parent.appendChild(style);
}

/**
 * `<cell-ui-sheet>` custom element: an embeddable spreadsheet with its styles
 * isolated in a Shadow DOM so host-page CSS cannot interfere (and vice versa).
 *
 * ```html
 * <cell-ui-sheet rows="200" cols="30" locale="ja" style="height:500px"></cell-ui-sheet>
 * <script>
 *   const el = document.querySelector('cell-ui-sheet');
 *   el.whenReady.then((sheet) => sheet.model.setValue(0, 0, 'Hello'));
 *   el.addEventListener('change', (e) => console.log(e.detail.cells));
 * </script>
 * ```
 *
 * Attributes: `rows`, `cols`, `locale`, `toolbar`, `formula-bar`, `status-bar`,
 * `context-menu`, `gridlines`, `fill-handle` (boolean attributes accept
 * "false" to disable), `fit-content` (`""`/`true`/`height`/`width` – size the
 * element to its rows/columns instead of a fixed height), `auto-expand`
 * (grow when Enter/Tab is pressed on the last row/column).
 * Methods: `appendRows(n)`, `appendColumns(n)`. Properties: `sheet`, `data` (get/set snapshot),
 * `options` (extra `SpreadsheetOptions` merged at construction).
 * Events: `ready`, `change`, `selectionchange`, `editcommit`, `paste`, `copy`.
 * Because `ready` may fire while the page is still parsing, prefer
 * `await el.whenReady` (or check `el.sheet`) over listening for the event.
 */
export class CellUiElement extends HTMLElement {
  static get observedAttributes(): string[] {
    return ['rows', 'cols', 'locale'];
  }

  sheet: Spreadsheet | null = null;
  /** Extra options applied when the element connects (plugins, defaults, data…). */
  options: SpreadsheetOptions = {};
  /** Resolves with the spreadsheet once the element is connected (safe to await from any point). */
  readonly whenReady: Promise<Spreadsheet>;
  private resolveReady!: (sheet: Spreadsheet) => void;
  private container: HTMLElement;
  private pendingData: Partial<SheetSnapshot> | null = null;
  private disposers: (() => void)[] = [];

  constructor() {
    super();
    this.whenReady = new Promise((resolve) => (this.resolveReady = resolve));
    const shadow = this.attachShadow({ mode: 'open' });
    injectStyles(shadow);
    const hostStyle = document.createElement('style');
    hostStyle.textContent =
      ':host{display:block;height:400px;contain:content}:host([hidden]){display:none}.cui-host{width:100%;height:100%}' +
      ':host([fit-content=""]),:host([fit-content=true]),:host([fit-content=height]){height:auto}' +
      ':host([fit-content=""]),:host([fit-content=true]),:host([fit-content=width]){width:max-content;max-width:100%}';
    shadow.appendChild(hostStyle);
    this.container = document.createElement('div');
    this.container.className = 'cui-host';
    shadow.appendChild(this.container);
  }

  /** Append rows at the bottom. */
  appendRows(count = 1): void {
    this.sheet?.appendRows(count);
  }

  /** Append columns at the right. */
  appendColumns(count = 1): void {
    this.sheet?.appendColumns(count);
  }

  private bool(name: string, fallback = true): boolean {
    const v = this.getAttribute(name);
    if (v === null) return fallback;
    return !(v === 'false' || v === '0' || v === 'off');
  }

  private fitAttr(): SpreadsheetOptions['fitContent'] {
    const v = this.getAttribute('fit-content');
    if (v === null || v === 'false') return false;
    if (v === 'height' || v === 'width') return v;
    return true;
  }

  private num(name: string): number | undefined {
    const v = this.getAttribute(name);
    if (v === null) return undefined;
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }

  connectedCallback(): void {
    if (this.sheet) return;
    const sheet = new Spreadsheet(this.container, {
      rows: this.num('rows'),
      cols: this.num('cols'),
      locale: this.getAttribute('locale') ?? undefined,
      toolbar: this.bool('toolbar'),
      formulaBar: this.bool('formula-bar'),
      statusBar: this.bool('status-bar'),
      contextMenu: this.bool('context-menu'),
      showGridlines: this.bool('gridlines'),
      fillHandle: this.bool('fill-handle'),
      fitContent: this.fitAttr(),
      autoExpand: this.bool('auto-expand', false),
      ...this.options,
      data: this.pendingData ?? this.options.data,
    });
    this.sheet = sheet;
    this.pendingData = null;
    const relay = <T>(name: string) => (detail: T) => this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
    this.disposers = [
      sheet.model.events.on('change', relay('change')),
      sheet.selection.events.on('change', relay('selectionchange')),
      sheet.events.on('editcommit', relay('editcommit')),
      sheet.events.on('paste', relay('paste')),
      sheet.events.on('copy', relay('copy')),
    ];
    this.resolveReady(sheet);
    this.dispatchEvent(new CustomEvent('ready', { detail: { sheet }, bubbles: true, composed: true }));
  }

  disconnectedCallback(): void {
    this.disposers.forEach((d) => d());
    this.disposers = [];
    if (this.sheet) {
      this.pendingData = this.sheet.toJSON();
      this.sheet.destroy();
      this.sheet = null;
    }
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    if (!this.sheet) return;
    if (name === 'rows' || name === 'cols') {
      const n = value === null ? undefined : parseInt(value, 10);
      if (n && n > 0) {
        this.sheet.model.resize(name === 'rows' ? n : this.sheet.model.rowCount, name === 'cols' ? n : this.sheet.model.colCount);
        this.sheet.grid.invalidateLayout();
        this.sheet.selection.revalidate();
        this.sheet.grid.scheduleRender();
      }
    }
  }

  /** Sheet content as a JSON snapshot. Setting it replaces the content. */
  get data(): SheetSnapshot | Partial<SheetSnapshot> | null {
    return this.sheet ? this.sheet.toJSON() : this.pendingData;
  }

  set data(snapshot: Partial<SheetSnapshot> | null) {
    if (this.sheet) this.sheet.load(snapshot ?? { cells: {} });
    else this.pendingData = snapshot;
  }

  override focus(): void {
    this.sheet?.focus();
  }
}

/** Register the custom element (idempotent). Returns the tag name used. */
export function defineCellUiElement(tagName = 'cell-ui-sheet'): string {
  if (typeof customElements !== 'undefined' && !customElements.get(tagName)) customElements.define(tagName, CellUiElement);
  return tagName;
}
