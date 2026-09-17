import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Spreadsheet } from '../src/spreadsheet';
import '../src/index';
import type { CellUiElement } from '../src/element';

let container: HTMLElement;
let sheet: Spreadsheet;

function key(k: string, mods: Partial<{ ctrl: boolean; shift: boolean }> = {}): void {
  sheet.grid.editor.dispatchEvent(new KeyboardEvent('keydown', { key: k, ctrlKey: !!mods.ctrl, shiftKey: !!mods.shift, bubbles: true, cancelable: true }));
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  sheet?.destroy();
  container.remove();
});

describe('fixed-size sheets and growing them', () => {
  it('starts at 10x5 and can append rows/columns', () => {
    sheet = new Spreadsheet(container, { rows: 10, cols: 5, fitContent: true });
    expect(sheet.model.rowCount).toBe(10);
    expect(sheet.model.colCount).toBe(5);
    expect(sheet.root.classList.contains('cui-root--fit-height')).toBe(true);
    sheet.model.setValue(9, 4, 'last');
    sheet.appendRows(2);
    sheet.appendColumns(1);
    expect(sheet.model.rowCount).toBe(12);
    expect(sheet.model.colCount).toBe(6);
    expect(sheet.model.getValue(9, 4)).toBe('last');
    sheet.model.undo();
    sheet.model.undo();
    expect(sheet.model.rowCount).toBe(10);
    expect(sheet.model.colCount).toBe(5);
    sheet.commands.execute('rows.append', { args: 3 });
    sheet.commands.execute('columns.append');
    expect(sheet.model.rowCount).toBe(13);
    expect(sheet.model.colCount).toBe(6);
  });

  it('sizes the grid to its content in fitContent mode', () => {
    sheet = new Spreadsheet(container, { rows: 10, cols: 5, fitContent: true });
    sheet.grid.render();
    const expectedH = 22 + 10 * sheet.model.defaultRowHeight + 3;
    const expectedW = 46 + 5 * sheet.model.defaultColumnWidth + 3;
    expect(sheet.grid.root.style.height).toBe(`${expectedH}px`);
    expect(sheet.grid.root.style.width).toBe(`${expectedW}px`);
    sheet.appendRows(1);
    sheet.grid.render();
    expect(sheet.grid.root.style.height).toBe(`${expectedH + sheet.model.defaultRowHeight}px`);
    sheet.destroy();
    sheet = new Spreadsheet(container, { rows: 10, cols: 5, fitContent: 'height' });
    sheet.grid.render();
    expect(sheet.grid.root.style.height).toBe(`${expectedH}px`);
    expect(sheet.grid.root.style.width).toBe('');
  });

  it('autoExpand grows on Enter at the last row and Tab at the last column', () => {
    sheet = new Spreadsheet(container, { rows: 3, cols: 2, autoExpand: true });
    sheet.focus();
    sheet.selection.setActive({ row: 2, col: 0 });
    key('Enter');
    expect(sheet.model.rowCount).toBe(4);
    expect(sheet.activeRef).toBe('A4');
    sheet.selection.setActive({ row: 0, col: 1 });
    key('Tab');
    expect(sheet.model.colCount).toBe(3);
    expect(sheet.activeRef).toBe('C1');
    key('ArrowRight');
    expect(sheet.model.colCount).toBe(4);
    // Shift+Arrow (extend) and Ctrl+Arrow (jump) never grow the sheet.
    sheet.selection.setActive({ row: 3, col: 0 });
    key('ArrowDown', { shift: true });
    key('ArrowDown', { ctrl: true });
    expect(sheet.model.rowCount).toBe(4);
  });

  it('autoExpand can be limited to one axis and is off by default', () => {
    sheet = new Spreadsheet(container, { rows: 2, cols: 2, autoExpand: { rows: true } });
    sheet.focus();
    sheet.selection.setActive({ row: 1, col: 1 });
    key('Tab');
    expect(sheet.model.colCount).toBe(2);
    key('Enter');
    expect(sheet.model.rowCount).toBe(3);
    sheet.destroy();
    sheet = new Spreadsheet(container, { rows: 2, cols: 2 });
    sheet.focus();
    sheet.selection.setActive({ row: 1, col: 1 });
    key('Enter');
    key('Tab');
    expect(sheet.model.rowCount).toBe(2);
    expect(sheet.model.colCount).toBe(2);
  });

  it('grows automatically when a larger block is pasted', () => {
    sheet = new Spreadsheet(container, { rows: 2, cols: 2 });
    sheet.pasteData({ text: '1\t2\t3\r\n4\t5\t6\r\n7\t8\t9\r\n' });
    expect(sheet.model.rowCount).toBe(3);
    expect(sheet.model.colCount).toBe(3);
    expect(sheet.model.getValue(2, 2)).toBe(9);
  });

  it('web component supports fit-content, auto-expand and append methods', () => {
    const el = document.createElement('cell-ui-sheet') as CellUiElement;
    el.setAttribute('rows', '10');
    el.setAttribute('cols', '5');
    el.setAttribute('fit-content', '');
    el.setAttribute('auto-expand', '');
    document.body.appendChild(el);
    expect(el.sheet!.options.fitContent).toBe(true);
    expect(el.sheet!.options.autoExpand).toBe(true);
    el.appendRows(5);
    el.appendColumns(1);
    expect(el.sheet!.model.rowCount).toBe(15);
    expect(el.sheet!.model.colCount).toBe(6);
    el.remove();
  });
});
