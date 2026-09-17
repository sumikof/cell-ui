import './styles.css';

export * from './model';
export * from './clipboard';
export * from './keyboard';
export * from './commands';
export * from './selection';
export * from './i18n';
export * from './plugins/api';
export { Spreadsheet } from './spreadsheet';
export type { SpreadsheetOptions, SpreadsheetEvents, EditMode, FillOptions } from './spreadsheet';
export { GridView, ROW_HEADER_WIDTH, COL_HEADER_HEIGHT } from './render/grid';
export { AxisLayout } from './render/layout';
export { Toolbar } from './ui/toolbar';
export { ContextMenu } from './ui/menu';
export { FormulaBar } from './ui/formulabar';
export { StatusBar } from './ui/statusbar';
export { openColorPicker, THEME_COLORS, STANDARD_COLORS } from './ui/colorpicker';
export { applyBorderPreset, currentRegion, installDefaultCommands } from './defaults/commands';
export type { BorderPreset } from './defaults/commands';
export { installDefaultKeymap } from './defaults/keymap';
export { installDefaultToolbar, FONT_FAMILIES, FONT_SIZES } from './defaults/toolbar';
export { installDefaultContextMenu } from './defaults/menu';

export { CellUiElement, defineCellUiElement, injectStyles, CELL_UI_CSS } from './element';

import { Spreadsheet, type SpreadsheetOptions } from './spreadsheet';
import { defineCellUiElement } from './element';

/** Convenience factory. */
export function createSpreadsheet(container: HTMLElement, options?: SpreadsheetOptions): Spreadsheet {
  return new Spreadsheet(container, options);
}

// Register <cell-ui-sheet> automatically when running in a browser.
if (typeof window !== 'undefined' && typeof customElements !== 'undefined') defineCellUiElement();
