import type { Spreadsheet } from '../spreadsheet';
import type { CommandRegistry } from '../commands';
import type { BorderStyle, CellRange, CellStyle } from '../model/types';
import { normalizeRange, rangeSize, sameRange } from '../model/address';

export type BorderPreset = 'all' | 'outside' | 'inside' | 'top' | 'bottom' | 'left' | 'right' | 'thickOutside' | 'none';

interface MoveArgs {
  dRow?: number;
  dCol?: number;
  extend?: boolean;
  jump?: boolean;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Apply a border preset to a range (Excel's border menu). */
export function applyBorderPreset(sheet: Spreadsheet, range: CellRange, preset: BorderPreset, color = '#000000'): void {
  const model = sheet.model;
  const r = normalizeRange(range);
  const thin: BorderStyle = { style: 'thin', color };
  const thick: BorderStyle = { style: 'medium', color };
  model.transact('borders', () => {
    for (let row = r.start.row; row <= r.end.row; row++) {
      for (let col = r.start.col; col <= r.end.col; col++) {
        const top = row === r.start.row;
        const bottom = row === r.end.row;
        const left = col === r.start.col;
        const right = col === r.end.col;
        const patch: Partial<CellStyle> = {};
        switch (preset) {
          case 'none':
            patch.borderTop = undefined;
            patch.borderBottom = undefined;
            patch.borderLeft = undefined;
            patch.borderRight = undefined;
            break;
          case 'all':
            patch.borderTop = thin;
            patch.borderBottom = thin;
            patch.borderLeft = thin;
            patch.borderRight = thin;
            break;
          case 'outside':
          case 'thickOutside': {
            const b = preset === 'outside' ? thin : thick;
            if (top) patch.borderTop = b;
            if (bottom) patch.borderBottom = b;
            if (left) patch.borderLeft = b;
            if (right) patch.borderRight = b;
            break;
          }
          case 'inside':
            if (!top) patch.borderTop = thin;
            if (!bottom) patch.borderBottom = thin;
            if (!left) patch.borderLeft = thin;
            if (!right) patch.borderRight = thin;
            break;
          case 'top':
            if (top) patch.borderTop = thin;
            break;
          case 'bottom':
            if (bottom) patch.borderBottom = thin;
            break;
          case 'left':
            if (left) patch.borderLeft = thin;
            break;
          case 'right':
            if (right) patch.borderRight = thin;
            break;
        }
        if (Object.keys(patch).length) model.setStyle(row, col, patch);
        // Keep the neighbour's shared edge consistent so that removing borders really removes them.
        if (preset === 'none') {
          if (top && row > 0) model.setStyle(row - 1, col, { borderBottom: undefined });
          if (bottom && row + 1 < model.rowCount) model.setStyle(row + 1, col, { borderTop: undefined });
          if (left && col > 0) model.setStyle(row, col - 1, { borderRight: undefined });
          if (right && col + 1 < model.colCount) model.setStyle(row, col + 1, { borderLeft: undefined });
        }
      }
    }
  });
}

/**
 * Excel's "current region": the block of non-empty cells around the active
 * cell, expanded until it is surrounded by empty rows and columns.
 */
export function currentRegion(sheet: Spreadsheet, from: CellRange): CellRange {
  const model = sheet.model;
  let r = normalizeRange(from);
  const hasContentInRow = (row: number, c0: number, c1: number) => {
    for (let c = c0; c <= c1; c++) if (model.hasContent(row, c)) return true;
    return false;
  };
  const hasContentInCol = (col: number, r0: number, r1: number) => {
    for (let rr = r0; rr <= r1; rr++) if (model.hasContent(rr, col)) return true;
    return false;
  };
  let changed = true;
  while (changed) {
    changed = false;
    const c0 = Math.max(0, r.start.col - 1);
    const c1 = Math.min(model.colCount - 1, r.end.col + 1);
    const r0 = Math.max(0, r.start.row - 1);
    const r1 = Math.min(model.rowCount - 1, r.end.row + 1);
    if (r.start.row > 0 && hasContentInRow(r.start.row - 1, c0, c1)) {
      r = { start: { row: r.start.row - 1, col: r.start.col }, end: r.end };
      changed = true;
    }
    if (r.end.row < model.rowCount - 1 && hasContentInRow(r.end.row + 1, c0, c1)) {
      r = { start: r.start, end: { row: r.end.row + 1, col: r.end.col } };
      changed = true;
    }
    if (r.start.col > 0 && hasContentInCol(r.start.col - 1, r0, r1)) {
      r = { start: { row: r.start.row, col: r.start.col - 1 }, end: r.end };
      changed = true;
    }
    if (r.end.col < model.colCount - 1 && hasContentInCol(r.end.col + 1, r0, r1)) {
      r = { start: r.start, end: { row: r.end.row, col: r.end.col + 1 } };
      changed = true;
    }
  }
  return r;
}

export function installDefaultCommands(commands: CommandRegistry<Spreadsheet>): void {
  const reg = (id: string, run: (sheet: Spreadsheet, args: any, event?: Event) => void | boolean | Promise<boolean>, label?: string) =>
    commands.register({ id, label, run: (ctx) => run(ctx.host, ctx.args, ctx.event) });

  // --- Navigation ------------------------------------------------------------
  reg('nav.move', (sheet, args: MoveArgs) => {
    sheet.moveActive(args.dRow ?? 0, args.dCol ?? 0, { extend: !!args.extend, jump: !!args.jump });
  });
  reg('nav.tab', (sheet, args: { back?: boolean } = {}) => sheet.tabMove(args.back ? -1 : 1));
  reg('nav.enter', (sheet, args: { back?: boolean } = {}) => sheet.enterMove(args.back ? -1 : 1));
  reg('nav.home', (sheet, args: { ctrl?: boolean; extend?: boolean } = {}) => {
    const target = args.ctrl ? { row: 0, col: 0 } : { row: sheet.selection.active.row, col: 0 };
    sheet.goTo(target, !!args.extend);
  });
  reg('nav.end', (sheet, args: { extend?: boolean } = {}) => {
    const used = sheet.model.usedRange();
    const target = used ? { row: used.end.row, col: used.end.col } : { row: 0, col: 0 };
    sheet.goTo(target, !!args.extend);
  });
  reg('nav.rowEnd', (sheet, args: { extend?: boolean } = {}) => {
    const used = sheet.model.usedRange();
    const row = sheet.selection.active.row;
    let col = 0;
    if (used) for (let c = used.end.col; c >= 0; c--) if (sheet.model.hasContent(row, c)) { col = c; break; }
    sheet.goTo({ row, col }, !!args.extend);
  });
  reg('nav.page', (sheet, args: { dRow?: number; dCol?: number; extend?: boolean } = {}) => {
    const rows = (args.dRow ?? 0) * sheet.grid.pageRows;
    const cols = (args.dCol ?? 0) * sheet.grid.pageCols;
    sheet.moveActive(rows, cols, { extend: !!args.extend });
  });

  // --- Selection -------------------------------------------------------------
  reg('select.all', (sheet, args: { force?: boolean } = {}) => {
    const sel = sheet.selection;
    if (!args.force) {
      const region = currentRegion(sheet, { start: sel.active, end: sel.active });
      const single = rangeSize(region).rows === 1 && rangeSize(region).cols === 1;
      if (!single && !sameRange(region, sel.range)) {
        sel.selectRange(region, sel.active);
        return;
      }
    }
    sel.selectAll();
  });
  reg('select.currentRegion', (sheet) => {
    const sel = sheet.selection;
    sel.selectRange(currentRegion(sheet, { start: sel.active, end: sel.active }), sel.active);
  });
  reg('select.row', (sheet) => {
    const r = normalizeRange(sheet.selection.range);
    sheet.selection.selectRows(r.start.row, r.end.row, sheet.selection.active.col);
  });
  reg('select.column', (sheet) => {
    const r = normalizeRange(sheet.selection.range);
    sheet.selection.selectColumns(r.start.col, r.end.col, sheet.selection.active.row);
  });

  // --- Editing ---------------------------------------------------------------
  reg('edit.start', (sheet) => sheet.startEdit('edit'));
  reg('edit.toggleMode', (sheet) => sheet.toggleEditMode());
  reg('edit.commit', (sheet, args: { dRow?: number; dCol?: number; fillSelection?: boolean } = {}) => {
    if (args.fillSelection) {
      sheet.commitEdit({ fillSelection: true });
      return;
    }
    if (!sheet.commitEdit()) return;
    if (args.dCol) sheet.tabMove(args.dCol > 0 ? 1 : -1);
    else if (args.dRow) sheet.enterMove(args.dRow > 0 ? 1 : -1);
  });
  reg('edit.cancel', (sheet) => sheet.cancelEdit());
  reg('edit.newline', (sheet) => sheet.insertEditorText('\n'));
  reg('edit.arrow', (sheet, args: MoveArgs) => {
    if (sheet.editMode !== 'enter') return false; // let the caret move
    if (!sheet.commitEdit()) return false;
    sheet.moveActive(args.dRow ?? 0, args.dCol ?? 0, {});
    return true;
  });

  // --- Cells -----------------------------------------------------------------
  reg('cell.clear', (sheet) => sheet.model.clearRange(sheet.selection.range, { values: true }));
  reg('cell.clearFormats', (sheet) => sheet.model.clearRange(sheet.selection.range, { styles: true }));
  reg('cell.clearAll', (sheet) => sheet.model.clearRange(sheet.selection.range, { values: true, styles: true }));
  reg('cell.backspace', (sheet) => {
    const a = sheet.selection.active;
    sheet.model.setValue(a.row, a.col, null);
    sheet.startEdit('enter', '');
  });

  // --- Clipboard -------------------------------------------------------------
  reg('clipboard.copy', (sheet, _args, event) => sheet.copyToClipboard(false, event));
  reg('clipboard.cut', (sheet, _args, event) => sheet.copyToClipboard(true, event));
  reg('clipboard.paste', (sheet, _args, event) => sheet.pasteFromClipboard({ event }));
  reg('clipboard.pasteValues', (sheet, _args, event) => sheet.pasteFromClipboard({ valuesOnly: true, event }));
  reg('clipboard.cancelCut', (sheet) => {
    if (!sheet.clipboard.cutRange) return false;
    sheet.clipboard.clearCut();
    sheet.grid.scheduleRender();
    return true;
  });

  // --- History ---------------------------------------------------------------
  reg('history.undo', (sheet) => {
    if (sheet.isEditing) sheet.cancelEdit();
    sheet.model.undo();
  });
  reg('history.redo', (sheet) => {
    if (sheet.isEditing) sheet.cancelEdit();
    sheet.model.redo();
  });

  // --- Formatting ------------------------------------------------------------
  reg('format.toggle', (sheet, key: 'bold' | 'italic' | 'underline' | 'strikethrough') => sheet.toggleStyle(key));
  reg('format.set', (sheet, patch: Partial<CellStyle>) => sheet.applyStyle(patch));
  reg('format.align', (sheet, value: CellStyle['hAlign']) => sheet.applyStyle({ hAlign: value }));
  reg('format.valign', (sheet, value: CellStyle['vAlign']) => sheet.applyStyle({ vAlign: value }));
  reg('format.wrap', (sheet) => sheet.toggleStyle('wrap'));
  reg('format.borders', (sheet, preset: BorderPreset) => applyBorderPreset(sheet, sheet.selection.range, preset));
  reg('format.fontSize', (sheet, delta: number) => {
    const sizes = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];
    const a = sheet.selection.active;
    const cur = sheet.model.getEffectiveStyle(a.row, a.col).fontSize ?? 11;
    let next: number;
    if (delta > 0) next = sizes.find((s) => s > cur) ?? cur + 2;
    else next = [...sizes].reverse().find((s) => s < cur) ?? Math.max(1, cur - 1);
    sheet.applyStyle({ fontSize: next });
  });
  reg('format.dialog', (sheet) => sheet.toolbar.focus());

  // --- Fill ------------------------------------------------------------------
  reg('fill.down', (sheet) => {
    const r = normalizeRange(sheet.selection.range);
    if (r.start.row === r.end.row) {
      if (r.start.row === 0) return;
      const src = { start: { row: r.start.row - 1, col: r.start.col }, end: { row: r.start.row - 1, col: r.end.col } };
      sheet.fillRange(src, { start: src.start, end: r.end });
    } else {
      const src = { start: r.start, end: { row: r.start.row, col: r.end.col } };
      sheet.fillRange(src, r, { series: false });
    }
  });
  reg('fill.right', (sheet) => {
    const r = normalizeRange(sheet.selection.range);
    if (r.start.col === r.end.col) {
      if (r.start.col === 0) return;
      const src = { start: { row: r.start.row, col: r.start.col - 1 }, end: { row: r.end.row, col: r.start.col - 1 } };
      sheet.fillRange(src, { start: src.start, end: r.end });
    } else {
      const src = { start: r.start, end: { row: r.end.row, col: r.start.col } };
      sheet.fillRange(src, r, { series: false });
    }
  });

  // --- Structure -------------------------------------------------------------
  reg('rows.insert', (sheet) => {
    const r = normalizeRange(sheet.selection.range);
    sheet.model.insertRows(r.start.row, rangeSize(r).rows);
  });
  reg('rows.delete', (sheet) => {
    const r = normalizeRange(sheet.selection.range);
    sheet.model.deleteRows(r.start.row, rangeSize(r).rows);
    sheet.selection.revalidate();
  });
  reg('columns.insert', (sheet) => {
    const r = normalizeRange(sheet.selection.range);
    sheet.model.insertColumns(r.start.col, rangeSize(r).cols);
  });
  reg('columns.delete', (sheet) => {
    const r = normalizeRange(sheet.selection.range);
    sheet.model.deleteColumns(r.start.col, rangeSize(r).cols);
    sheet.selection.revalidate();
  });
  reg('structure.insert', (sheet) => {
    if (sheet.selection.mode === 'columns') commands.execute('columns.insert');
    else commands.execute('rows.insert');
  });
  reg('structure.delete', (sheet) => {
    if (sheet.selection.mode === 'columns') commands.execute('columns.delete');
    else commands.execute('rows.delete');
  });
  reg('rows.hide', (sheet) => {
    const r = normalizeRange(sheet.selection.range);
    sheet.model.transact('hideRows', () => {
      for (let row = r.start.row; row <= r.end.row; row++) sheet.model.setRowHeight(row, 0);
    });
  });
  reg('rows.unhide', (sheet) => {
    const r = normalizeRange(sheet.selection.range);
    sheet.model.transact('unhideRows', () => {
      for (let row = r.start.row; row <= r.end.row; row++) if (sheet.model.getRowHeight(row) === 0) sheet.model.setRowHeight(row, undefined);
    });
  });
  reg('columns.hide', (sheet) => {
    const r = normalizeRange(sheet.selection.range);
    sheet.model.transact('hideColumns', () => {
      for (let col = r.start.col; col <= r.end.col; col++) sheet.model.setColumnWidth(col, 0);
    });
  });
  reg('columns.unhide', (sheet) => {
    const r = normalizeRange(sheet.selection.range);
    sheet.model.transact('unhideColumns', () => {
      for (let col = r.start.col; col <= r.end.col; col++) if (sheet.model.getColumnWidth(col) === 0) sheet.model.setColumnWidth(col, undefined);
    });
  });
  reg('columns.autoFit', (sheet) => {
    const r = normalizeRange(sheet.selection.range);
    sheet.model.transact('autoFitColumns', () => {
      for (let col = r.start.col; col <= r.end.col; col++) sheet.model.setColumnWidth(col, sheet.grid.autoFitWidth(col));
    });
  });
  reg('rows.autoFit', (sheet) => {
    const r = normalizeRange(sheet.selection.range);
    sheet.model.transact('autoFitRows', () => {
      for (let row = r.start.row; row <= r.end.row; row++) sheet.model.setRowHeight(row, sheet.grid.autoFitHeight(row));
    });
  });

  // --- Insert ----------------------------------------------------------------
  reg('insert.date', (sheet) => {
    const d = new Date();
    sheet.enterText(`${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`);
  });
  reg('insert.time', (sheet) => {
    const d = new Date();
    sheet.enterText(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
  });
}
