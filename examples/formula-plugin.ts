/**
 * Example plugin: a tiny formula engine layered on top of the core.
 *
 * The core deliberately ships without formulas; this file shows how the
 * extension points compose to add them:
 *  - `addValueParser` keeps the source text (`=SUM(A1:A3)`) in `cell.meta.formula`
 *  - `addDisplayResolver` evaluates and shows the result
 *  - `addEditTextResolver` shows the source when editing
 *  - `addCellRenderer` colours formula cells
 *  - a toolbar button and a shortcut (Alt+=) insert `=SUM(` like Excel's AutoSum
 */
import type { CellAddress, CellData, Spreadsheet, SpreadsheetPlugin } from '../src';
import { a1ToAddress, a1ToRange, iterateRange } from '../src';

function evaluate(formula: string, sheet: Spreadsheet, self: CellAddress, depth = 0): number | string {
  if (depth > 20) return '#CYCLE!';
  const body = formula.slice(1).trim();
  const valueOf = (addr: CellAddress): number => {
    if (addr.row === self.row && addr.col === self.col) throw new Error('#CYCLE!');
    const cell = sheet.model.getCell(addr.row, addr.col);
    const f = cell?.meta?.formula;
    if (typeof f === 'string') {
      const v = evaluate(f, sheet, addr, depth + 1);
      if (typeof v === 'string') throw new Error(v);
      return v;
    }
    const v = cell?.value;
    return typeof v === 'number' ? v : typeof v === 'boolean' ? (v ? 1 : 0) : Number(v) || 0;
  };
  const rangeValues = (ref: string): number[] => {
    const range = a1ToRange(ref);
    if (!range) throw new Error('#REF!');
    return Array.from(iterateRange(range)).map(valueOf);
  };
  try {
    const fn = /^(SUM|AVERAGE|MIN|MAX|COUNT)\(([^)]*)\)$/i.exec(body);
    if (fn) {
      const args = fn[2].split(',').map((s) => s.trim()).filter(Boolean);
      const values = args.flatMap((a) => (a.includes(':') ? rangeValues(a) : [a1ToAddress(a) ? valueOf(a1ToAddress(a)!) : Number(a)]));
      switch (fn[1].toUpperCase()) {
        case 'SUM':
          return values.reduce((x, y) => x + y, 0);
        case 'AVERAGE':
          return values.length ? values.reduce((x, y) => x + y, 0) / values.length : 0;
        case 'MIN':
          return Math.min(...values);
        case 'MAX':
          return Math.max(...values);
        case 'COUNT':
          return values.length;
      }
    }
    // Simple arithmetic with cell references: =A1*2+B3
    const expr = body.replace(/\$?[A-Z]{1,3}\$?\d+/gi, (ref) => String(valueOf(a1ToAddress(ref)!)));
    if (!/^[\d\s+\-*/().]+$/.test(expr)) return '#NAME?';
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict";return (${expr})`)();
    return typeof result === 'number' && Number.isFinite(result) ? Math.round(result * 1e10) / 1e10 : '#DIV/0!';
  } catch (e) {
    return e instanceof Error ? e.message : '#ERROR!';
  }
}

export const formulaPlugin: SpreadsheetPlugin = {
  name: 'example-formulas',
  install(sheet) {
    const cleanups = [
      sheet.addValueParser((text): CellData | undefined => {
        if (!text.startsWith('=') || text.length < 2) return undefined;
        return { value: null, meta: { formula: text } };
      }),
      sheet.addDisplayResolver((cell, addr) => {
        const f = cell?.meta?.formula;
        if (typeof f !== 'string') return undefined;
        const v = evaluate(f, sheet, addr);
        return typeof v === 'number' ? String(v) : v;
      }),
      sheet.addEditTextResolver((cell) => {
        const f = cell?.meta?.formula;
        return typeof f === 'string' ? f : undefined;
      }),
      sheet.addCellRenderer((el, cell) => {
        el.classList.toggle('formula-cell', typeof cell?.meta?.formula === 'string');
      }),
      sheet.commands.register({
        id: 'example.autoSum',
        label: 'AutoSum',
        run: ({ host }) => {
          const a = host.selection.active;
          let r = a.row - 1;
          while (r >= 0 && typeof host.model.getValue(r, a.col) === 'number') r--;
          const from = r + 1;
          if (from < a.row) {
            host.enterText(`=SUM(${String.fromCharCode(65 + a.col)}${from + 1}:${String.fromCharCode(65 + a.col)}${a.row})`);
          } else {
            host.startEdit('enter', '=SUM(');
          }
        },
      }),
      sheet.keymap.bind('Alt+=', 'example.autoSum'),
      sheet.toolbar.add({ id: 'example.autoSum', type: 'button', label: 'Σ', title: 'AutoSum (Alt+=)', command: 'example.autoSum', order: 200 }),
      sheet.contextMenu.add({ id: 'example.autoSum', label: 'AutoSum', command: 'example.autoSum', order: 200 }),
    ];
    // Formula results depend on other cells: re-render on any change.
    cleanups.push(sheet.model.events.on('change', () => sheet.grid.scheduleRender()));
    return () => cleanups.forEach((c) => c());
  },
};
