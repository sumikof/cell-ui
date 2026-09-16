import type { CellAddress, CellData, CellValue } from '../model/types';
import type { Spreadsheet } from '../spreadsheet';

/**
 * Extension points.
 *
 * A plugin receives the `Spreadsheet` instance and may:
 *  - register commands (`sheet.commands.register`) and key bindings (`sheet.keymap.bind`)
 *  - add toolbar items (`sheet.toolbar.add`) and context-menu items (`sheet.contextMenu.add`)
 *  - intercept text entry (`sheet.addValueParser`) – e.g. to treat `=SUM(A1:A3)` as a formula
 *  - control what a cell displays (`sheet.addDisplayResolver`) – e.g. show a formula's result
 *  - decorate rendered cells (`sheet.addCellRenderer`) – e.g. draw icons or data bars
 *  - store per-cell state in `CellData.meta`
 *  - listen to model/selection events
 */
export interface SpreadsheetPlugin {
  name: string;
  /** Return a cleanup function to run when the spreadsheet is destroyed or the plugin removed. */
  install(sheet: Spreadsheet): void | (() => void);
}

/**
 * Converts text committed from the editor (or pasted as plain text) into cell
 * data. Return `undefined` to let the next parser (and finally the default
 * Excel-like parser) handle it.
 */
export type ValueParser = (text: string, address: CellAddress, sheet: Spreadsheet) => CellData | CellValue | undefined;

/**
 * Produces the display text for a cell. Return `undefined` to fall through to
 * the default (`formatValue`). Used for on-screen rendering and for the plain
 * text placed on the clipboard.
 */
export type DisplayResolver = (cell: CellData | undefined, address: CellAddress, sheet: Spreadsheet) => string | undefined;

/**
 * Produces the text shown in the editor / formula bar when editing a cell.
 * Return `undefined` to fall through to the default (`editableText`).
 */
export type EditTextResolver = (cell: CellData | undefined, address: CellAddress, sheet: Spreadsheet) => string | undefined;

/** Called after a cell element has been rendered; may decorate it further. */
export type CellRenderer = (element: HTMLElement, cell: CellData | undefined, address: CellAddress, sheet: Spreadsheet) => void;

export interface ToolbarItemBase {
  id: string;
  /** Lower comes first. Defaults to 100 for plugin items (built-ins use 0–90). */
  order?: number;
}

export interface ToolbarButton extends ToolbarItemBase {
  type: 'button';
  /** Text or HTML (icons) shown inside the button. */
  label: string;
  title?: string;
  /** Command executed on click. */
  command?: string;
  args?: unknown;
  onClick?: (sheet: Spreadsheet, event: MouseEvent) => void;
  /** Called on every refresh to update the pressed state. */
  isActive?: (sheet: Spreadsheet) => boolean;
  isEnabled?: (sheet: Spreadsheet) => boolean;
}

export interface ToolbarSelect extends ToolbarItemBase {
  type: 'select';
  title?: string;
  options: { value: string; label: string; style?: string }[];
  getValue: (sheet: Spreadsheet) => string;
  onChange: (sheet: Spreadsheet, value: string) => void;
  width?: number;
  /** Allow typing a custom value (e.g. font size). */
  editable?: boolean;
}

export interface ToolbarSeparator extends ToolbarItemBase {
  type: 'separator';
}

export interface ToolbarCustom extends ToolbarItemBase {
  type: 'custom';
  render: (sheet: Spreadsheet) => HTMLElement;
  /** Called on every refresh with the element created by `render`. */
  update?: (sheet: Spreadsheet, element: HTMLElement) => void;
}

export type ToolbarItem = ToolbarButton | ToolbarSelect | ToolbarSeparator | ToolbarCustom;

export interface ContextMenuItem {
  id: string;
  label?: string;
  separator?: boolean;
  command?: string;
  args?: unknown;
  run?: (sheet: Spreadsheet) => void;
  isEnabled?: (sheet: Spreadsheet) => boolean;
  isVisible?: (sheet: Spreadsheet) => boolean;
  shortcut?: string;
  order?: number;
}
