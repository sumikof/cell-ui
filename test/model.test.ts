import { describe, it, expect, vi } from 'vitest';
import { SheetModel } from '../src/model/sheet';

describe('SheetModel', () => {
  it('stores values and styles sparsely', () => {
    const m = new SheetModel({ rows: 10, cols: 5 });
    expect(m.getValue(0, 0)).toBeNull();
    m.setValue(0, 0, 'a');
    m.setStyle(0, 0, { bold: true });
    expect(m.getCell(0, 0)).toEqual({ value: 'a', style: { bold: true }, meta: undefined });
    expect(m.cellCount).toBe(1);
    m.setStyle(0, 0, { bold: undefined });
    expect(m.getCell(0, 0)?.style).toBeUndefined();
    m.setValue(0, 0, null);
    expect(m.getCell(0, 0)).toBeUndefined();
    expect(m.cellCount).toBe(0);
  });

  it('undoes and redoes transactions as a unit', () => {
    const m = new SheetModel({ rows: 10, cols: 5 });
    const changes: string[] = [];
    m.events.on('change', (e) => changes.push(e.label));
    m.transact('fill', () => {
      m.setValue(0, 0, 1);
      m.setValue(1, 0, 2);
      m.setStyle(1, 0, { italic: true });
    });
    expect(changes).toEqual(['fill']);
    expect(m.canUndo).toBe(true);
    m.undo();
    expect(m.getValue(0, 0)).toBeNull();
    expect(m.getValue(1, 0)).toBeNull();
    expect(m.canRedo).toBe(true);
    m.redo();
    expect(m.getValue(1, 0)).toBe(2);
    expect(m.getStyle(1, 0)).toEqual({ italic: true });
    expect(changes).toEqual(['fill', 'undo', 'redo']);
  });

  it('ignores no-op transactions in history', () => {
    const m = new SheetModel();
    m.setValue(0, 0, 'x');
    m.transact('noop', () => {
      m.setValue(0, 0, 'x');
    });
    expect(m.canUndo).toBe(true);
    m.undo();
    expect(m.canUndo).toBe(false);
    expect(m.getValue(0, 0)).toBeNull();
  });

  it('inserts and deletes rows shifting cells and heights', () => {
    const m = new SheetModel({ rows: 10, cols: 3 });
    m.setValue(0, 0, 'r0');
    m.setValue(1, 0, 'r1');
    m.setValue(2, 0, 'r2');
    m.setRowHeight(2, 40);
    m.insertRows(1, 2);
    expect(m.rowCount).toBe(12);
    expect(m.getValue(0, 0)).toBe('r0');
    expect(m.getValue(1, 0)).toBeNull();
    expect(m.getValue(3, 0)).toBe('r1');
    expect(m.getValue(4, 0)).toBe('r2');
    expect(m.getRowHeight(4)).toBe(40);
    expect(m.getRowHeight(2)).toBe(m.defaultRowHeight);
    m.undo();
    expect(m.rowCount).toBe(10);
    expect(m.getValue(1, 0)).toBe('r1');
    expect(m.getRowHeight(2)).toBe(40);
    m.deleteRows(0, 2);
    expect(m.rowCount).toBe(8);
    expect(m.getValue(0, 0)).toBe('r2');
    expect(m.getRowHeight(0)).toBe(40);
    m.undo();
    expect(m.getValue(0, 0)).toBe('r0');
    expect(m.getValue(2, 0)).toBe('r2');
  });

  it('inserts and deletes columns', () => {
    const m = new SheetModel({ rows: 3, cols: 5 });
    m.setValue(0, 0, 'a');
    m.setValue(0, 1, 'b');
    m.setColumnWidth(1, 150);
    m.insertColumns(1, 1);
    expect(m.colCount).toBe(6);
    expect(m.getValue(0, 1)).toBeNull();
    expect(m.getValue(0, 2)).toBe('b');
    expect(m.getColumnWidth(2)).toBe(150);
    m.deleteColumns(0, 2);
    expect(m.getValue(0, 0)).toBe('b');
    expect(m.colCount).toBe(4);
  });

  it('computes the used range', () => {
    const m = new SheetModel();
    expect(m.usedRange()).toBeNull();
    m.setValue(3, 2, 'x');
    m.setValue(7, 5, 'y');
    expect(m.usedRange()).toEqual({ start: { row: 3, col: 2 }, end: { row: 7, col: 5 } });
  });

  it('round-trips through JSON', () => {
    const m = new SheetModel({ rows: 5, cols: 5 });
    m.setCell(1, 1, { value: 42, style: { bold: true, color: '#ff0000' }, meta: { note: 'hi' } });
    m.setColumnWidth(1, 99);
    const json = JSON.parse(JSON.stringify(m.toJSON()));
    const m2 = new SheetModel();
    m2.load(json);
    expect(m2.rowCount).toBe(5);
    expect(m2.getCell(1, 1)).toEqual({ value: 42, style: { bold: true, color: '#ff0000' }, meta: { note: 'hi' } });
    expect(m2.getColumnWidth(1)).toBe(99);
    m2.undo();
    expect(m2.cellCount).toBe(0);
  });

  it('applies style to ranges and clears selectively', () => {
    const m = new SheetModel();
    const range = { start: { row: 0, col: 0 }, end: { row: 1, col: 1 } };
    m.setValue(0, 0, 'v');
    m.applyStyle(range, { backgroundColor: '#ffff00' });
    expect(m.cellCount).toBe(4);
    m.clearRange(range, { values: true });
    expect(m.getValue(0, 0)).toBeNull();
    expect(m.getStyle(0, 0)).toEqual({ backgroundColor: '#ffff00' });
    m.clearRange(range, { styles: true });
    expect(m.cellCount).toBe(0);
  });

  it('limits history length', () => {
    const m = new SheetModel({ historyLimit: 3 });
    for (let i = 0; i < 5; i++) m.setValue(0, 0, i);
    let n = 0;
    while (m.undo()) n++;
    expect(n).toBe(3);
    expect(m.getValue(0, 0)).toBe(1);
  });

  it('emits history events', () => {
    const m = new SheetModel();
    const spy = vi.fn();
    m.events.on('history', spy);
    m.setValue(0, 0, 1);
    expect(spy).toHaveBeenLastCalledWith({ canUndo: true, canRedo: false });
  });
});
