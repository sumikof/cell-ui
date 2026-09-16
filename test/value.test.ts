import { describe, it, expect } from 'vitest';
import { parseInputValue, formatValue, editableText, formatNumber } from '../src/model/value';

describe('value parsing/formatting', () => {
  it('parses numbers, booleans and text like Excel', () => {
    expect(parseInputValue('123')).toBe(123);
    expect(parseInputValue('-1.5')).toBe(-1.5);
    expect(parseInputValue('1e3')).toBe(1000);
    expect(parseInputValue(' 42 ')).toBe(42);
    expect(parseInputValue('TRUE')).toBe(true);
    expect(parseInputValue('false')).toBe(false);
    expect(parseInputValue('hello')).toBe('hello');
    expect(parseInputValue('')).toBeNull();
    expect(parseInputValue("'123")).toBe('123');
    expect(parseInputValue('=SUM(A1)')).toBe('=SUM(A1)');
    expect(parseInputValue('12abc')).toBe('12abc');
  });

  it('formats values', () => {
    expect(formatValue(null)).toBe('');
    expect(formatValue(12)).toBe('12');
    expect(formatValue(true)).toBe('TRUE');
    expect(formatValue('x')).toBe('x');
    expect(formatNumber(0.1 + 0.2)).toBe('0.3');
    expect(formatNumber(1 / 3)).toBe('0.33333333333');
  });

  it('escapes number-like strings for editing', () => {
    expect(editableText({ value: '123' })).toBe("'123");
    expect(editableText({ value: 'TRUE' })).toBe("'TRUE");
    expect(editableText({ value: 123 })).toBe('123');
    expect(editableText({ value: 'abc' })).toBe('abc');
    expect(editableText(undefined)).toBe('');
  });
});
