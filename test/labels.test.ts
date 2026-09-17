import { describe, it, expect, afterEach, vi } from 'vitest';
import { Spreadsheet } from '../src/spreadsheet';
import '../src/index';
import type { CellUiElement } from '../src/element';

let sheet: Spreadsheet | null = null;
let container: HTMLElement | null = null;

afterEach(() => {
  sheet?.destroy();
  container?.remove();
  sheet = null;
  container = null;
  vi.restoreAllMocks();
});

function make(options = {}) {
  container = document.createElement('div');
  document.body.appendChild(container);
  sheet = new Spreadsheet(container, { rows: 5, cols: 4, ...options });
  return sheet;
}

describe('formula bar parts', () => {
  it('hides only the function input while keeping the name box', () => {
    const s = make({ formulaBar: { input: false } });
    expect(s.root.querySelector('.cui-formulabar')).not.toBeNull();
    expect(s.formulaBar.nameBox.style.display).toBe('');
    expect(s.formulaBar.input.style.display).toBe('none');
    expect(s.isVisible('formulaBar')).toBe(true);
    expect(s.isVisible('nameBox')).toBe(true);
    expect(s.isVisible('formulaInput')).toBe(false);
  });

  it('toggles parts at runtime and removes the bar when both are off', () => {
    const s = make();
    s.setVisible('formulaInput', false);
    expect(s.formulaBar.input.style.display).toBe('none');
    expect(s.options.formulaBar).toEqual({ nameBox: true, input: false });
    s.setVisible('nameBox', false);
    expect(s.options.formulaBar).toBe(false);
    expect(s.root.querySelector('.cui-formulabar')).toBeNull();
    s.setVisible('formulaInput', true);
    expect(s.options.formulaBar).toEqual({ nameBox: false, input: true });
    expect(s.root.querySelector('.cui-formulabar')).not.toBeNull();
    expect(s.formulaBar.nameBox.style.display).toBe('none');
    s.setVisible('nameBox', true);
    expect(s.options.formulaBar).toBe(true);
  });
});

describe('custom column labels', () => {
  it('replaces letters on fixed-width sheets and falls back for missing labels', () => {
    const s = make({ fitContent: true, columnLabels: ['品名', '数量', undefined] });
    expect(s.columnLabel(0)).toBe('品名');
    expect(s.columnLabel(1)).toBe('数量');
    expect(s.columnLabel(2)).toBe('C');
    expect(s.columnLabel(3)).toBe('D');
    s.grid.render();
    const headers = Array.from(s.root.querySelectorAll('.cui-header-col')).map((h) => h.textContent);
    expect(headers[0]).toBe('品名');
    // Cell references keep using letters.
    s.selection.setActive({ row: 0, col: 0 });
    expect(s.activeRef).toBe('A1');
    s.setColumnLabels((col) => (col === 3 ? 'Note' : undefined));
    expect(s.columnLabel(0)).toBe('A');
    expect(s.columnLabel(3)).toBe('Note');
  });

  it('is accepted for width-only fit and ignored (with a warning) on scrolling sheets', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = make({ fitContent: 'width', columnLabels: ['X'] });
    expect(s.columnLabel(0)).toBe('X');
    expect(warn).not.toHaveBeenCalled();
    s.destroy();
    sheet = null;
    const s2 = make({ columnLabels: ['X'] });
    expect(s2.columnLabel(0)).toBe('A');
    expect(s2.columnLabel(1)).toBe('B');
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('web component parses column-labels and formula-input attributes', () => {
    const el = document.createElement('cell-ui-sheet') as CellUiElement;
    el.setAttribute('rows', '3');
    el.setAttribute('cols', '3');
    el.setAttribute('fit-content', '');
    el.setAttribute('column-labels', '品名, 数量,,');
    el.setAttribute('formula-input', 'false');
    document.body.appendChild(el);
    const s = el.sheet!;
    expect(s.columnLabel(0)).toBe('品名');
    expect(s.columnLabel(1)).toBe('数量');
    expect(s.columnLabel(2)).toBe('C');
    expect(s.formulaBar.input.style.display).toBe('none');
    expect(s.formulaBar.nameBox.style.display).toBe('');
    el.setAttribute('column-labels', '["a","b","c"]');
    expect(s.columnLabel(2)).toBe('c');
    el.setAttribute('formula-input', 'true');
    expect(s.formulaBar.input.style.display).toBe('');
    el.setAttribute('formula-bar', 'false');
    expect(el.shadowRoot!.querySelector('.cui-formulabar')).toBeNull();
    el.remove();
  });
});
