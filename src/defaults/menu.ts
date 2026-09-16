import type { Spreadsheet } from '../spreadsheet';

export function installDefaultContextMenu(sheet: Spreadsheet): void {
  const t = sheet.strings;
  const mod = sheet.isMac ? '⌘' : 'Ctrl+';
  const menu = sheet.contextMenu;
  menu.add({ id: 'cut', order: 0, label: t.cut, command: 'clipboard.cut', shortcut: `${mod}X` });
  menu.add({ id: 'copy', order: 1, label: t.copy, command: 'clipboard.copy', shortcut: `${mod}C` });
  menu.add({ id: 'paste', order: 2, label: t.paste, command: 'clipboard.paste', shortcut: `${mod}V` });
  menu.add({ id: 'pasteValues', order: 3, label: t.pasteValues, command: 'clipboard.pasteValues', shortcut: `${mod}⇧V` });
  menu.add({ id: 'sep1', order: 4, separator: true });
  menu.add({ id: 'insertRows', order: 10, label: t.insertRowsAbove, command: 'rows.insert', isVisible: (s) => s.selection.mode !== 'columns' });
  menu.add({ id: 'insertColumns', order: 11, label: t.insertColumnsLeft, command: 'columns.insert', isVisible: (s) => s.selection.mode !== 'rows' });
  menu.add({ id: 'deleteRows', order: 12, label: t.deleteRows, command: 'rows.delete', isVisible: (s) => s.selection.mode !== 'columns' });
  menu.add({ id: 'deleteColumns', order: 13, label: t.deleteColumns, command: 'columns.delete', isVisible: (s) => s.selection.mode !== 'rows' });
  menu.add({ id: 'sep2', order: 14, separator: true });
  menu.add({ id: 'hideRows', order: 20, label: t.hideRows, command: 'rows.hide', isVisible: (s) => s.selection.mode === 'rows' });
  menu.add({ id: 'unhideRows', order: 21, label: t.unhideRows, command: 'rows.unhide', isVisible: (s) => s.selection.mode === 'rows' });
  menu.add({ id: 'autoFitRows', order: 22, label: t.autoFitRow, command: 'rows.autoFit', isVisible: (s) => s.selection.mode === 'rows' });
  menu.add({ id: 'hideColumns', order: 23, label: t.hideColumns, command: 'columns.hide', isVisible: (s) => s.selection.mode === 'columns' });
  menu.add({ id: 'unhideColumns', order: 24, label: t.unhideColumns, command: 'columns.unhide', isVisible: (s) => s.selection.mode === 'columns' });
  menu.add({ id: 'autoFitColumns', order: 25, label: t.autoFitColumn, command: 'columns.autoFit', isVisible: (s) => s.selection.mode === 'columns' });
  menu.add({ id: 'sep3', order: 26, separator: true });
  menu.add({ id: 'clearContents', order: 30, label: t.clearContents, command: 'cell.clear', shortcut: 'Delete' });
  menu.add({ id: 'clearFormats', order: 31, label: t.clearFormats, command: 'cell.clearFormats' });
}
