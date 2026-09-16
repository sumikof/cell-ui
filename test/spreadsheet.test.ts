import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Spreadsheet } from '../src/spreadsheet';
import { rangeToA1 } from '../src/model/address';
import { computePasteRange } from '../src/clipboard';

let container: HTMLElement;
let sheet: Spreadsheet;

function key(k: string, mods: Partial<{ ctrl: boolean; shift: boolean; alt: boolean; meta: boolean; code: string }> = {}): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { key: k, code: mods.code, ctrlKey: !!mods.ctrl, shiftKey: !!mods.shift, altKey: !!mods.alt, metaKey: !!mods.meta, bubbles: true, cancelable: true });
  sheet.grid.editor.dispatchEvent(e);
  return e;
}

function type(text: string): void {
  sheet.grid.editor.value = text;
  sheet.grid.editor.dispatchEvent(new Event('input', { bubbles: true }));
}

function selA1(): string {
  return rangeToA1(sheet.selection.range);
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  sheet = new Spreadsheet(container, { rows: 50, cols: 20, locale: 'en' });
  sheet.focus();
});

afterEach(() => {
  sheet.destroy();
  container.remove();
});

describe('Spreadsheet keyboard behaviour', () => {
  it('moves with arrows and extends with shift', () => {
    key('ArrowDown');
    key('ArrowRight');
    expect(sheet.activeRef).toBe('B2');
    key('ArrowRight', { shift: true });
    key('ArrowDown', { shift: true });
    expect(selA1()).toBe('B2:C3');
    expect(sheet.activeRef).toBe('B2');
    key('ArrowUp');
    expect(selA1()).toBe('B1');
  });

  it('jumps with ctrl+arrow like Excel', () => {
    sheet.model.setValue(0, 0, 1);
    sheet.model.setValue(1, 0, 2);
    sheet.model.setValue(2, 0, 3);
    sheet.model.setValue(6, 0, 'far');
    key('ArrowDown', { ctrl: true });
    expect(sheet.activeRef).toBe('A3');
    key('ArrowDown', { ctrl: true });
    expect(sheet.activeRef).toBe('A7');
    key('ArrowDown', { ctrl: true });
    expect(sheet.activeRef).toBe('A50');
    key('ArrowUp', { ctrl: true });
    expect(sheet.activeRef).toBe('A7');
    key('ArrowUp', { ctrl: true, shift: true });
    expect(selA1()).toBe('A3:A7');
  });

  it('types to edit and commits with Enter, moving down', () => {
    type('hello');
    expect(sheet.isEditing).toBe(true);
    expect(sheet.editMode).toBe('enter');
    key('Enter');
    expect(sheet.isEditing).toBe(false);
    expect(sheet.model.getValue(0, 0)).toBe('hello');
    expect(sheet.activeRef).toBe('A2');
    type('42');
    key('Tab');
    expect(sheet.model.getValue(1, 0)).toBe(42);
    expect(sheet.activeRef).toBe('B2');
  });

  it('returns to the tab start column on Enter', () => {
    key('Tab');
    key('Tab');
    expect(sheet.activeRef).toBe('C1');
    key('Enter');
    expect(sheet.activeRef).toBe('A2');
  });

  it('commits and moves on arrow keys in enter mode but not in edit mode', () => {
    type('abc');
    key('ArrowRight');
    expect(sheet.isEditing).toBe(false);
    expect(sheet.model.getValue(0, 0)).toBe('abc');
    expect(sheet.activeRef).toBe('B1');
    key('F2');
    expect(sheet.editMode).toBe('edit');
    const e = key('ArrowLeft');
    expect(sheet.isEditing).toBe(true);
    expect(e.defaultPrevented).toBe(false);
    key('Escape');
    expect(sheet.isEditing).toBe(false);
    expect(sheet.model.getValue(0, 1)).toBeNull();
  });

  it('F2 edits existing text and Escape restores it', () => {
    sheet.model.setValue(0, 0, 'orig');
    key('F2');
    expect(sheet.grid.editor.value).toBe('orig');
    type('changed');
    key('Escape');
    expect(sheet.model.getValue(0, 0)).toBe('orig');
  });

  it('Delete clears the selection; Backspace clears and edits', () => {
    sheet.model.setValue(0, 0, 'a');
    sheet.model.setValue(0, 1, 'b');
    key('ArrowRight', { shift: true });
    key('Delete');
    expect(sheet.model.getValue(0, 0)).toBeNull();
    expect(sheet.model.getValue(0, 1)).toBeNull();
    sheet.model.setValue(0, 0, 'x');
    sheet.selection.setActive({ row: 0, col: 0 });
    key('Backspace');
    expect(sheet.isEditing).toBe(true);
    expect(sheet.grid.editor.value).toBe('');
    key('Escape');
    expect(sheet.model.getValue(0, 0)).toBeNull();
  });

  it('undo/redo with Ctrl+Z / Ctrl+Y', () => {
    type('one');
    key('Enter');
    key('z', { ctrl: true });
    expect(sheet.model.getValue(0, 0)).toBeNull();
    key('y', { ctrl: true });
    expect(sheet.model.getValue(0, 0)).toBe('one');
  });

  it('toggles bold/italic/underline with shortcuts', () => {
    key('b', { ctrl: true });
    key('i', { ctrl: true });
    key('u', { ctrl: true });
    expect(sheet.model.getStyle(0, 0)).toEqual({ bold: true, italic: true, underline: true });
    key('b', { ctrl: true });
    expect(sheet.model.getStyle(0, 0).bold).toBeUndefined();
    key('5', { ctrl: true, code: 'Digit5' });
    expect(sheet.model.getStyle(0, 0).strikethrough).toBe(true);
  });

  it('selects rows/columns/all with Shift+Space, Ctrl+Space, Ctrl+A', () => {
    key(' ', { shift: true });
    expect(sheet.selection.mode).toBe('rows');
    expect(selA1()).toBe('A1:T1');
    sheet.selection.setActive({ row: 2, col: 1 });
    key(' ', { ctrl: true });
    expect(sheet.selection.mode).toBe('columns');
    expect(selA1()).toBe('B1:B50');
    // Ctrl+Space on a full-row selection selects everything, like Excel.
    key(' ', { shift: true });
    key(' ', { ctrl: true });
    expect(sheet.selection.mode).toBe('all');
    sheet.selection.setActive({ row: 0, col: 0 });
    key('a', { ctrl: true });
    expect(sheet.selection.mode).toBe('all');
  });

  it('Ctrl+A selects the current region first', () => {
    sheet.model.setValue(0, 0, 1);
    sheet.model.setValue(0, 1, 2);
    sheet.model.setValue(1, 0, 3);
    sheet.model.setValue(5, 5, 'x');
    key('a', { ctrl: true });
    expect(selA1()).toBe('A1:B2');
    key('a', { ctrl: true });
    expect(sheet.selection.mode).toBe('all');
  });

  it('fills down and right with Ctrl+D / Ctrl+R', () => {
    sheet.model.setCell(0, 0, { value: 'v', style: { bold: true } });
    key('ArrowDown', { shift: true });
    key('ArrowDown', { shift: true });
    key('d', { ctrl: true });
    expect(sheet.model.getValue(2, 0)).toBe('v');
    expect(sheet.model.getStyle(2, 0)).toEqual({ bold: true });
    sheet.selection.setActive({ row: 0, col: 0 });
    key('ArrowRight', { shift: true });
    key('r', { ctrl: true });
    expect(sheet.model.getValue(0, 1)).toBe('v');
  });

  it('inserts and deletes rows with Ctrl+Plus / Ctrl+Minus', () => {
    sheet.model.setValue(0, 0, 'a');
    sheet.model.setValue(1, 0, 'b');
    sheet.selection.selectRows(1);
    key('+', { ctrl: true, shift: true, code: 'Equal' });
    expect(sheet.model.rowCount).toBe(51);
    expect(sheet.model.getValue(2, 0)).toBe('b');
    sheet.selection.selectRows(1);
    key('-', { ctrl: true, code: 'Minus' });
    expect(sheet.model.rowCount).toBe(50);
    expect(sheet.model.getValue(1, 0)).toBe('b');
  });

  it('hides and unhides rows with Ctrl+9 / Ctrl+Shift+9', () => {
    sheet.selection.selectRows(1, 2);
    key('9', { ctrl: true, code: 'Digit9' });
    expect(sheet.model.getRowHeight(1)).toBe(0);
    expect(sheet.model.getRowHeight(2)).toBe(0);
    sheet.selection.setActive({ row: 0, col: 0 });
    key('ArrowDown');
    expect(sheet.activeRef).toBe('A4');
    sheet.selection.selectRows(0, 3);
    key('(', { ctrl: true, shift: true, code: 'Digit9' });
    expect(sheet.model.getRowHeight(1)).toBe(sheet.model.defaultRowHeight);
  });

  it('Home / Ctrl+Home / Ctrl+End', () => {
    sheet.model.setValue(4, 4, 'x');
    sheet.selection.setActive({ row: 3, col: 3 });
    key('Home');
    expect(sheet.activeRef).toBe('A4');
    key('End', { ctrl: true });
    expect(sheet.activeRef).toBe('E5');
    key('Home', { ctrl: true });
    expect(sheet.activeRef).toBe('A1');
  });

  it('Alt+Enter inserts a newline while editing', () => {
    type('a');
    key('Enter', { alt: true });
    expect(sheet.grid.editor.value).toBe('a\n');
    key('Enter');
    expect(sheet.model.getValue(0, 0)).toBe('a\n');
  });

  it('Ctrl+Enter fills the selection with the entry', () => {
    sheet.selection.selectRange({ start: { row: 0, col: 0 }, end: { row: 1, col: 1 } });
    type('z');
    key('Enter', { ctrl: true });
    expect(sheet.model.getValue(1, 1)).toBe('z');
    expect(selA1()).toBe('A1:B2');
  });

  it('applies border shortcuts', () => {
    sheet.selection.selectRange({ start: { row: 0, col: 0 }, end: { row: 1, col: 1 } });
    key('&', { ctrl: true, shift: true, code: 'Digit7' });
    expect(sheet.model.getStyle(0, 0).borderTop).toEqual({ style: 'thin', color: '#000000' });
    expect(sheet.model.getStyle(0, 0).borderBottom).toBeUndefined();
    expect(sheet.model.getStyle(1, 1).borderBottom).toEqual({ style: 'thin', color: '#000000' });
    key('_', { ctrl: true, shift: true, code: 'Minus' });
    expect(sheet.model.getStyle(0, 0)).toEqual({});
  });
});

describe('Spreadsheet clipboard', () => {
  function clipboardEvent(type: 'copy' | 'cut' | 'paste', data: Record<string, string> = {}): { event: Event; store: Record<string, string> } {
    const store: Record<string, string> = { ...data };
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', {
      value: {
        getData: (t: string) => store[t] ?? '',
        setData: (t: string, v: string) => {
          store[t] = v;
        },
      },
    });
    sheet.grid.editor.dispatchEvent(event);
    return { event, store };
  }

  it('copies TSV + HTML and pastes back in-app preserving styles and meta', () => {
    sheet.model.setCell(0, 0, { value: 1, style: { bold: true }, meta: { k: 'v' } });
    sheet.model.setCell(0, 1, { value: 'two' });
    sheet.selection.selectRange({ start: { row: 0, col: 0 }, end: { row: 0, col: 1 } });
    const { store, event } = clipboardEvent('copy');
    expect(event.defaultPrevented).toBe(true);
    expect(store['text/plain']).toBe('1\ttwo\r\n');
    expect(store['text/html']).toContain('<td style="font-weight:bold" x:num="1">1</td>');
    sheet.selection.setActive({ row: 2, col: 2 });
    clipboardEvent('paste', store);
    expect(sheet.model.getCell(2, 2)).toEqual({ value: 1, style: { bold: true }, meta: { k: 'v' } });
    expect(sheet.model.getValue(2, 3)).toBe('two');
    expect(selA1()).toBe('C3:D3');
  });

  it('cut + paste moves cells', () => {
    sheet.model.setValue(0, 0, 'm');
    const { store } = clipboardEvent('cut');
    expect(sheet.clipboard.cutRange).not.toBeNull();
    sheet.selection.setActive({ row: 1, col: 1 });
    clipboardEvent('paste', store);
    expect(sheet.model.getValue(0, 0)).toBeNull();
    expect(sheet.model.getValue(1, 1)).toBe('m');
    expect(sheet.clipboard.cutRange).toBeNull();
  });

  it('pastes Excel HTML with styles, and TSV as values', () => {
    const html = `<html><head><style>.xl1{font-weight:700;color:#0000FF}</style></head><body><table><tr><td class=xl1 x:num>10</td><td>a</td></tr><tr><td>20</td><td>b</td></tr></table></body></html>`;
    clipboardEvent('paste', { 'text/html': html, 'text/plain': '10\ta\r\n20\tb\r\n' });
    expect(sheet.model.getCell(0, 0)).toEqual({ value: 10, style: { bold: true, color: '#0000ff' } });
    expect(sheet.model.getValue(1, 1)).toBe('b');
    sheet.selection.setActive({ row: 5, col: 0 });
    clipboardEvent('paste', { 'text/plain': 'x\ty\r\n1\t2\r\n' });
    expect(sheet.model.getValue(5, 0)).toBe('x');
    expect(sheet.model.getValue(6, 1)).toBe(2);
  });

  it('paste values only via Ctrl+Shift+V drops styles', () => {
    const html = `<table><tr><td style="font-weight:bold">1</td></tr></table>`;
    key('v', { ctrl: true, shift: true });
    clipboardEvent('paste', { 'text/html': html, 'text/plain': '1\r\n' });
    expect(sheet.model.getCell(0, 0)).toEqual({ value: 1, style: undefined, meta: undefined });
  });

  it('tiles a block over a selection that is a multiple of its size', () => {
    expect(computePasteRange({ start: { row: 0, col: 0 }, end: { row: 3, col: 1 } }, 2, 1)).toEqual({ start: { row: 0, col: 0 }, end: { row: 3, col: 1 } });
    expect(computePasteRange({ start: { row: 0, col: 0 }, end: { row: 2, col: 0 } }, 2, 1)).toEqual({ start: { row: 0, col: 0 }, end: { row: 1, col: 0 } });
    sheet.selection.selectRange({ start: { row: 0, col: 0 }, end: { row: 1, col: 2 } });
    clipboardEvent('paste', { 'text/plain': 'q' });
    for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) expect(sheet.model.getValue(r, c)).toBe('q');
  });

  it('does not intercept clipboard events while editing', () => {
    type('abc');
    const { event } = clipboardEvent('copy');
    expect(event.defaultPrevented).toBe(false);
  });
});

describe('Spreadsheet fill handle semantics', () => {
  it('extrapolates numeric series and increments trailing numbers', () => {
    sheet.model.setValue(0, 0, 1);
    sheet.model.setValue(1, 0, 3);
    sheet.fillRange({ start: { row: 0, col: 0 }, end: { row: 1, col: 0 } }, { start: { row: 0, col: 0 }, end: { row: 4, col: 0 } });
    expect([2, 3, 4].map((r) => sheet.model.getValue(r, 0))).toEqual([5, 7, 9]);
    sheet.model.setValue(0, 1, 'Item1');
    sheet.fillRange({ start: { row: 0, col: 1 }, end: { row: 0, col: 1 } }, { start: { row: 0, col: 1 }, end: { row: 2, col: 1 } });
    expect(sheet.model.getValue(2, 1)).toBe('Item3');
    sheet.model.setValue(0, 2, 'x');
    sheet.model.setValue(0, 3, 'y');
    sheet.fillRange({ start: { row: 0, col: 2 }, end: { row: 0, col: 3 } }, { start: { row: 0, col: 2 }, end: { row: 0, col: 6 } });
    expect([4, 5, 6].map((c) => sheet.model.getValue(0, c))).toEqual(['x', 'y', 'x']);
  });

  it('fills backwards', () => {
    sheet.model.setValue(5, 0, 10);
    sheet.model.setValue(6, 0, 20);
    sheet.fillRange({ start: { row: 5, col: 0 }, end: { row: 6, col: 0 } }, { start: { row: 3, col: 0 }, end: { row: 6, col: 0 } });
    expect(sheet.model.getValue(4, 0)).toBe(0);
    expect(sheet.model.getValue(3, 0)).toBe(-10);
  });
});

describe('Spreadsheet extensibility', () => {
  it('lets plugins intercept parsing, display and commands', () => {
    const removed: string[] = [];
    sheet.use({
      name: 'test',
      install(s) {
        const offs = [
          s.addValueParser((text) => (text.startsWith('=') ? { value: null, meta: { formula: text } } : undefined)),
          s.addDisplayResolver((cell) => (typeof cell?.meta?.formula === 'string' ? 'RESULT' : undefined)),
          s.addEditTextResolver((cell) => (typeof cell?.meta?.formula === 'string' ? (cell.meta.formula as string) : undefined)),
          s.commands.register({ id: 'test.hello', run: ({ host }) => host.model.setValue(9, 9, 'hi') }),
          s.keymap.bind('Mod+Shift+H', 'test.hello'),
        ];
        return () => {
          offs.forEach((o) => o());
          removed.push('test');
        };
      },
    });
    type('=A1');
    key('Enter');
    expect(sheet.model.getCell(0, 0)?.meta).toEqual({ formula: '=A1' });
    expect(sheet.displayText({ row: 0, col: 0 })).toBe('RESULT');
    expect(sheet.editText({ row: 0, col: 0 })).toBe('=A1');
    key('H', { ctrl: true, shift: true });
    expect(sheet.model.getValue(9, 9)).toBe('hi');
    sheet.removePlugin('test');
    expect(removed).toEqual(['test']);
    expect(sheet.displayText({ row: 0, col: 0 })).toBe('');
  });

  it('exposes toolbar and context menu registries', () => {
    const off = sheet.toolbar.add({ id: 'x', type: 'button', label: 'X', command: 'history.undo' });
    expect(sheet.toolbar.get('x')).toBeDefined();
    off();
    expect(sheet.toolbar.get('x')).toBeUndefined();
    sheet.contextMenu.add({ id: 'y', label: 'Y', command: 'cell.clear' });
    expect(sheet.contextMenu.list().some((i) => i.id === 'y')).toBe(true);
  });

  it('rebinding a shortcut overrides the default', () => {
    sheet.keymap.bind('Enter', 'nav.tab');
    key('Enter');
    expect(sheet.activeRef).toBe('B1');
  });
});
