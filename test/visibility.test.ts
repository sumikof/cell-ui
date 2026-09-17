import { describe, it, expect, afterEach } from 'vitest';
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
});

function make(options = {}) {
  container = document.createElement('div');
  document.body.appendChild(container);
  sheet = new Spreadsheet(container, { rows: 5, cols: 3, ...options });
  return sheet;
}

describe('hiding UI parts', () => {
  it('constructor options hide toolbar, formula bar, status bar and headers', () => {
    const s = make({ toolbar: false, formulaBar: false, statusBar: false, contextMenu: false, headers: false });
    expect(s.root.querySelector('.cui-toolbar')).toBeNull();
    expect(s.root.querySelector('.cui-formulabar')).toBeNull();
    expect(s.root.querySelector('.cui-statusbar')).toBeNull();
    expect(s.grid.headerWidth).toBe(0);
    expect(s.grid.headerHeight).toBe(0);
    expect(s.grid.viewport.style.left).toBe('0px');
    expect(s.grid.viewport.style.top).toBe('0px');
    expect((s.root.querySelector('.cui-colheader-wrap') as HTMLElement).style.display).toBe('none');
    expect((s.root.querySelector('.cui-rowheader-wrap') as HTMLElement).style.display).toBe('none');
    s.contextMenu.show(1, 1);
    expect(document.querySelector('.cui-menu')).toBeNull();
    // Still usable without headers
    s.grid.render();
    expect(s.root.querySelectorAll('.cui-cell').length).toBeGreaterThan(0);
    s.model.setValue(0, 0, 'x');
    expect(s.model.getValue(0, 0)).toBe('x');
  });

  it('can hide only one header axis and size headers', () => {
    const s = make({ headers: { rows: false }, columnHeaderHeight: 30 });
    expect(s.grid.headerWidth).toBe(0);
    expect(s.grid.headerHeight).toBe(30);
    expect(s.isVisible('rowHeaders')).toBe(false);
    expect(s.isVisible('columnHeaders')).toBe(true);
    expect(s.isVisible('headers')).toBe(false);
    s.grid.render();
    expect(s.root.querySelectorAll('.cui-header-col').length).toBeGreaterThan(0);
    expect(s.root.querySelectorAll('.cui-header-row').length).toBe(0);
  });

  it('setVisible toggles parts at runtime and keeps panel order', () => {
    const s = make();
    expect(s.isVisible('toolbar')).toBe(true);
    s.setVisible('toolbar', false);
    s.setVisible('statusBar', false);
    s.setVisible('headers', false);
    expect(s.root.querySelector('.cui-toolbar')).toBeNull();
    expect(s.root.querySelector('.cui-statusbar')).toBeNull();
    expect(s.grid.headerWidth).toBe(0);
    expect(s.grid.viewport.style.left).toBe('0px');
    s.setVisible('toolbar', true);
    s.setVisible('statusBar', true);
    s.setVisible('columnHeaders', true);
    const order = Array.from(s.root.children).map((c) => c.className.split(' ')[0]);
    expect(order).toEqual(['cui-toolbar', 'cui-formulabar', 'cui-grid', 'cui-statusbar']);
    expect(s.grid.headerHeight).toBe(22);
    expect(s.grid.headerWidth).toBe(0);
    expect(s.isVisible('columnHeaders')).toBe(true);
    s.setVisible('rowHeaders', true);
    expect(s.options.headers).toBe(true);
    s.setVisible('fillHandle', false);
    s.setVisible('gridlines', false);
    s.grid.render();
    expect(s.root.querySelectorAll('.cui-gridline-v').length).toBe(0);
  });

  it('fitContent accounts for hidden headers', () => {
    const s = make({ headers: false, fitContent: true });
    s.grid.render();
    expect(s.grid.root.style.height).toBe(`${5 * s.model.defaultRowHeight + 3}px`);
    expect(s.grid.root.style.width).toBe(`${3 * s.model.defaultColumnWidth + 3}px`);
  });

  it('web component attributes control parts and react to changes', () => {
    const el = document.createElement('cell-ui-sheet') as CellUiElement;
    el.setAttribute('rows', '4');
    el.setAttribute('cols', '2');
    el.setAttribute('headers', 'false');
    el.setAttribute('toolbar', 'false');
    document.body.appendChild(el);
    const s = el.sheet!;
    expect(s.grid.headerWidth).toBe(0);
    expect(el.shadowRoot!.querySelector('.cui-toolbar')).toBeNull();
    el.setAttribute('toolbar', 'true');
    expect(el.shadowRoot!.querySelector('.cui-toolbar')).not.toBeNull();
    el.setAttribute('headers', 'true');
    expect(s.grid.headerWidth).toBe(46);
    el.setAttribute('row-headers', 'false');
    expect(s.grid.headerWidth).toBe(0);
    expect(s.grid.headerHeight).toBe(22);
    el.setAttribute('status-bar', 'false');
    expect(el.shadowRoot!.querySelector('.cui-statusbar')).toBeNull();
    el.remove();
  });
});
