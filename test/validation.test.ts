import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Spreadsheet } from '../src/spreadsheet';
import { SheetModel } from '../src/model/sheet';
import { columnRange, rowRange, shiftEntries, subtractRange, validateBuiltin, TO_END } from '../src/model/validation';
import { getStrings } from '../src/i18n';

const en = getStrings('en');

describe('validation rules (pure)', () => {
  it('validates numbers', () => {
    expect(validateBuiltin({ type: 'number' }, 12, en)).toBeNull();
    expect(validateBuiltin({ type: 'number' }, 'abc', en)).toBe(en.invalidNumber);
    expect(validateBuiltin({ type: 'number' }, '', en)).toBeNull();
    expect(validateBuiltin({ type: 'number', allowBlank: false }, null, en)).toBe(en.blankNotAllowed);
    expect(validateBuiltin({ type: 'number', integer: true }, 1.5, en)).toBe(en.invalidInteger);
    expect(validateBuiltin({ type: 'number', min: 0 }, -1, en)).toBe('Please enter a number of at least 0.');
    expect(validateBuiltin({ type: 'number', max: 10 }, 11, en)).toBe('Please enter a number of at most 10.');
    expect(validateBuiltin({ type: 'number', min: 1, max: 5 }, 9, en)).toBe('Please enter a number between 1 and 5.');
    expect(validateBuiltin({ type: 'number', min: 1, max: 5, message: 'custom' }, 9, en)).toBe('custom');
  });

  it('validates lists', () => {
    const rule = { type: 'list' as const, options: ['a', 'b', 3] };
    expect(validateBuiltin(rule, 'a', en)).toBeNull();
    expect(validateBuiltin(rule, 3, en)).toBeNull();
    expect(validateBuiltin(rule, '3', en)).toBeNull();
    expect(validateBuiltin(rule, 'zzz', en)).toBe('Please choose one of: a, b, 3');
    expect(validateBuiltin({ ...rule, allowOther: true }, 'zzz', en)).toBeNull();
  });

  it('subtracts and shifts ranges', () => {
    const entries = [{ range: columnRange(1), rule: { type: 'number' } }];
    const cut = subtractRange(entries, { start: { row: 2, col: 1 }, end: { row: 3, col: 1 } });
    expect(cut).toEqual([
      { rule: { type: 'number' }, range: { start: { row: 0, col: 1 }, end: { row: 1, col: 1 } } },
      { rule: { type: 'number' }, range: { start: { row: 4, col: 1 }, end: { row: TO_END, col: 1 } } },
    ]);
    const shifted = shiftEntries([{ range: { start: { row: 2, col: 0 }, end: { row: 5, col: 0 } }, rule: { type: 'number' } }], 'row', 3, 2);
    expect(shifted[0].range).toEqual({ start: { row: 2, col: 0 }, end: { row: 7, col: 0 } });
    const deleted = shiftEntries([{ range: { start: { row: 2, col: 0 }, end: { row: 5, col: 0 } }, rule: { type: 'number' } }], 'row', 0, -3);
    expect(deleted[0].range).toEqual({ start: { row: 0, col: 0 }, end: { row: 2, col: 0 } });
    const gone = shiftEntries([{ range: { start: { row: 2, col: 0 }, end: { row: 2, col: 0 } }, rule: { type: 'number' } }], 'row', 2, -1);
    expect(gone).toEqual([]);
    const colShift = shiftEntries([{ range: rowRange(0), rule: { type: 'list', options: [] } }], 'col', 0, 1);
    expect(colShift[0].range).toEqual({ start: { row: 0, col: 1 }, end: { row: 0, col: TO_END } });
  });
});

describe('SheetModel validation storage', () => {
  it('stores rules per range with undo and JSON round-trip', () => {
    const m = new SheetModel({ rows: 10, cols: 3 });
    m.setValidation(columnRange(1), { type: 'number' });
    expect(m.getValidation(9, 1)).toEqual({ type: 'number' });
    expect(m.getValidation(0, 0)).toBeUndefined();
    m.setValidation({ start: { row: 0, col: 1 }, end: { row: 0, col: 1 } }, { type: 'list', options: ['x'] });
    expect(m.getValidation(0, 1)?.type).toBe('list');
    expect(m.getValidation(1, 1)?.type).toBe('number');
    m.undo();
    expect(m.getValidation(0, 1)?.type).toBe('number');
    m.redo();
    expect(m.getValidation(0, 1)?.type).toBe('list');
    m.insertColumns(0, 1);
    expect(m.getValidation(1, 2)?.type).toBe('number');
    expect(m.getValidation(1, 1)).toBeUndefined();
    m.appendRows(5);
    expect(m.getValidation(14, 2)?.type).toBe('number');
    const m2 = new SheetModel();
    m2.load(JSON.parse(JSON.stringify(m.toJSON())));
    expect(m2.getValidation(14, 2)?.type).toBe('number');
    expect(m2.getValidation(0, 2)?.type).toBe('list');
    m.setValidation(columnRange(2), null);
    expect(m.getValidation(3, 2)).toBeUndefined();
    m.clearValidations();
    expect(m.getValidations()).toEqual([]);
  });
});

describe('Spreadsheet validation behaviour', () => {
  let container: HTMLElement;
  let sheet: Spreadsheet;
  const key = (k: string, mods: Partial<{ alt: boolean }> = {}) =>
    sheet.grid.editor.dispatchEvent(new KeyboardEvent('keydown', { key: k, altKey: !!mods.alt, bubbles: true, cancelable: true }));
  const type = (text: string) => {
    sheet.grid.editor.value = text;
    sheet.grid.editor.dispatchEvent(new Event('input', { bubbles: true }));
  };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    sheet = new Spreadsheet(container, { rows: 10, cols: 3, locale: 'ja' });
    sheet.model.setValidation(columnRange(1), { type: 'number', min: 0, integer: true });
    sheet.model.setValidation(columnRange(2), { type: 'list', options: ['A', 'B'] });
    sheet.focus();
  });
  afterEach(() => {
    sheet.destroy();
    container.remove();
  });

  it('rejects invalid entries, keeps editing and shows a message', () => {
    const errors: string[] = [];
    sheet.events.on('validationerror', (e) => errors.push(e.message));
    sheet.selection.setActive({ row: 0, col: 1 });
    type('abc');
    key('Enter');
    expect(sheet.isEditing).toBe(true);
    expect(sheet.model.getValue(0, 1)).toBeNull();
    expect(errors).toEqual(['数値を入力してください。']);
    expect(sheet.root.querySelector('.cui-validation-error')?.textContent).toContain('数値を入力してください。');
    type('1.5');
    key('Enter');
    expect(errors[1]).toBe('整数を入力してください。');
    type('-3');
    key('Enter');
    expect(errors[2]).toBe('0 以上の数値を入力してください。');
    type('42');
    key('Enter');
    expect(sheet.isEditing).toBe(false);
    expect(sheet.model.getValue(0, 1)).toBe(42);
    expect(sheet.root.querySelector('.cui-validation-error')).toBeNull();
    // Escape cancels a rejected entry
    type('x');
    key('Enter');
    key('Escape');
    expect(sheet.isEditing).toBe(false);
    expect(sheet.model.getValue(1, 1)).toBeNull();
  });

  it('enforces list rules and offers a dropdown', () => {
    sheet.selection.setActive({ row: 0, col: 2 });
    type('C');
    key('Enter');
    expect(sheet.isEditing).toBe(true);
    key('Escape');
    type('B');
    key('Enter');
    expect(sheet.model.getValue(0, 2)).toBe('B');
    sheet.selection.setActive({ row: 1, col: 2 });
    expect(sheet.openListDropdown()).toBe(true);
    const items = Array.from(sheet.popoverHost.querySelectorAll('.cui-dropdown-item')).map((i) => i.textContent);
    expect(items).toEqual(['A', 'B']);
    (sheet.popoverHost.querySelectorAll('.cui-dropdown-item')[0] as HTMLButtonElement).click();
    expect(sheet.model.getValue(1, 2)).toBe('A');
    expect(sheet.popoverHost.querySelector('.cui-dropdown')).toBeNull();
    sheet.selection.setActive({ row: 0, col: 0 });
    expect(sheet.openListDropdown()).toBe(false);
    sheet.selection.setActive({ row: 2, col: 2 });
    key('ArrowDown', { alt: true });
    expect(sheet.popoverHost.querySelector('.cui-dropdown')).not.toBeNull();
    sheet.closeListDropdown();
  });

  it('shows the dropdown button on list cells and marks invalid stored values', () => {
    sheet.selection.setActive({ row: 0, col: 2 });
    sheet.grid.render();
    const btn = sheet.root.querySelector('.cui-dropdown-button') as HTMLElement;
    expect(btn.style.display).toBe('');
    sheet.selection.setActive({ row: 0, col: 0 });
    sheet.grid.render();
    expect(btn.style.display).toBe('none');
    // Pasted values are not blocked but flagged
    sheet.selection.setActive({ row: 3, col: 1 });
    sheet.pasteData({ text: 'oops' });
    expect(sheet.model.getValue(3, 1)).toBe('oops');
    expect(sheet.isInvalid({ row: 3, col: 1 })).toBe(true);
    expect(sheet.validateAll()).toEqual([{ address: { row: 3, col: 1 }, message: '数値を入力してください。' }]);
    expect(sheet.isInvalid({ row: 0, col: 1 })).toBe(false);
  });

  it('supports custom validator types', () => {
    sheet.registerValidator('even', (v) => (typeof v === 'number' && v % 2 === 0 ? null : 'even only'));
    sheet.model.setValidation({ start: { row: 0, col: 0 }, end: { row: 0, col: 0 } }, { type: 'even' });
    expect(sheet.validate({ row: 0, col: 0 }, 3)).toBe('even only');
    expect(sheet.validate({ row: 0, col: 0 }, 4)).toBeNull();
  });
});
