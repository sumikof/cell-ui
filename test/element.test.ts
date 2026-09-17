import { describe, it, expect } from 'vitest';
import '../src/index';
import { CellUiElement } from '../src/element';

describe('<cell-ui-sheet> custom element', () => {
  it('creates a spreadsheet in a shadow root and relays events', async () => {
    const el = document.createElement('cell-ui-sheet') as CellUiElement;
    el.setAttribute('rows', '20');
    el.setAttribute('cols', '5');
    el.setAttribute('toolbar', 'false');
    let ready = false;
    const changes: unknown[] = [];
    el.addEventListener('ready', () => (ready = true));
    el.addEventListener('change', (e) => changes.push((e as CustomEvent).detail));
    document.body.appendChild(el);
    expect(ready).toBe(true);
    expect(el.sheet).not.toBeNull();
    expect(await el.whenReady).toBe(el.sheet);
    expect(el.sheet!.model.rowCount).toBe(20);
    expect(el.shadowRoot!.querySelector('.cui-root')).not.toBeNull();
    expect(el.shadowRoot!.querySelector('.cui-toolbar')).toBeNull();
    expect(el.shadowRoot!.querySelector('style[data-cell-ui-styles]')).not.toBeNull();
    el.sheet!.model.setValue(0, 0, 'x');
    expect(changes.length).toBe(1);
    expect(el.sheet!.popoverHost).toBe(el.shadowRoot);
    el.sheet!.contextMenu.show(10, 10);
    expect(el.shadowRoot!.querySelector('.cui-menu')).not.toBeNull();
    el.sheet!.contextMenu.hide();

    // data property round-trips and survives re-attachment
    const snapshot = el.data!;
    expect(snapshot.cells?.['0,0']?.value).toBe('x');
    el.remove();
    expect(el.sheet).toBeNull();
    document.body.appendChild(el);
    expect(el.sheet!.model.getValue(0, 0)).toBe('x');
    el.data = { cells: { '1,1': { value: 7 } } };
    expect(el.sheet!.model.getValue(0, 0)).toBeNull();
    expect(el.sheet!.model.getValue(1, 1)).toBe(7);
    el.setAttribute('rows', '5');
    expect(el.sheet!.model.rowCount).toBe(5);
    el.remove();
  });
});
