import { describe, it, expect } from 'vitest';
import { columnLabel, columnIndex, addressToA1, a1ToAddress, a1ToRange, rangeToA1, normalizeRange, rangeContains } from '../src/model/address';

describe('address helpers', () => {
  it('converts column indices to labels and back', () => {
    expect(columnLabel(0)).toBe('A');
    expect(columnLabel(25)).toBe('Z');
    expect(columnLabel(26)).toBe('AA');
    expect(columnLabel(701)).toBe('ZZ');
    expect(columnLabel(702)).toBe('AAA');
    for (const i of [0, 1, 25, 26, 51, 52, 701, 702, 16383]) expect(columnIndex(columnLabel(i))).toBe(i);
    expect(columnIndex('a')).toBe(0);
    expect(columnIndex('1')).toBe(-1);
  });

  it('parses and formats A1 references', () => {
    expect(addressToA1({ row: 0, col: 0 })).toBe('A1');
    expect(addressToA1({ row: 9, col: 27 })).toBe('AB10');
    expect(a1ToAddress('B3')).toEqual({ row: 2, col: 1 });
    expect(a1ToAddress('$B$3')).toEqual({ row: 2, col: 1 });
    expect(a1ToAddress('b3')).toEqual({ row: 2, col: 1 });
    expect(a1ToAddress('3B')).toBeNull();
    expect(a1ToAddress('A0')).toBeNull();
  });

  it('parses ranges in any corner order', () => {
    expect(a1ToRange('C3:A1')).toEqual({ start: { row: 0, col: 0 }, end: { row: 2, col: 2 } });
    expect(a1ToRange('B2')).toEqual({ start: { row: 1, col: 1 }, end: { row: 1, col: 1 } });
    expect(rangeToA1({ start: { row: 2, col: 2 }, end: { row: 0, col: 0 } })).toBe('A1:C3');
    expect(rangeToA1({ start: { row: 1, col: 1 }, end: { row: 1, col: 1 } })).toBe('B2');
  });

  it('normalises and tests containment', () => {
    const r = normalizeRange({ start: { row: 5, col: 5 }, end: { row: 1, col: 2 } });
    expect(r).toEqual({ start: { row: 1, col: 2 }, end: { row: 5, col: 5 } });
    expect(rangeContains(r, { row: 3, col: 3 })).toBe(true);
    expect(rangeContains(r, { row: 0, col: 3 })).toBe(false);
  });
});
