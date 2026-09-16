import type { Spreadsheet } from '../spreadsheet';
import type { ToolbarItem } from '../plugins/api';

/** Formatting toolbar. Items are contributed through `add()`; built-ins live in `defaults/toolbar.ts`. */
export class Toolbar {
  readonly element: HTMLElement;
  private items: ToolbarItem[] = [];
  private rendered = new Map<string, { item: ToolbarItem; el: HTMLElement }>();
  private dirty = true;

  constructor(private readonly sheet: Spreadsheet) {
    this.element = document.createElement('div');
    this.element.className = 'cui-toolbar';
    this.element.setAttribute('role', 'toolbar');
    // Keep keyboard focus on the grid while clicking buttons.
    this.element.addEventListener('mousedown', (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('select, input')) return;
      e.preventDefault();
    });
  }

  add(item: ToolbarItem): () => void {
    this.items = this.items.filter((i) => i.id !== item.id);
    this.items.push(item);
    this.dirty = true;
    this.render();
    return () => this.remove(item.id);
  }

  remove(id: string): void {
    this.items = this.items.filter((i) => i.id !== id);
    this.dirty = true;
    this.render();
  }

  get(id: string): ToolbarItem | undefined {
    return this.items.find((i) => i.id === id);
  }

  list(): ToolbarItem[] {
    return [...this.items].sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
  }

  focus(): void {
    const first = this.element.querySelector<HTMLElement>('button, select, input');
    first?.focus();
  }

  render(): void {
    if (!this.dirty) return;
    this.dirty = false;
    this.element.replaceChildren();
    this.rendered.clear();
    for (const item of this.list()) {
      const el = this.createItem(item);
      this.element.appendChild(el);
      this.rendered.set(item.id, { item, el });
    }
    this.refresh();
  }

  /** Update pressed/enabled/current values from the selection. */
  refresh(): void {
    const sheet = this.sheet;
    for (const { item, el } of this.rendered.values()) {
      switch (item.type) {
        case 'button': {
          const btn = el as HTMLButtonElement;
          const active = item.isActive ? item.isActive(sheet) : false;
          btn.classList.toggle('cui-tb-btn--active', active);
          btn.setAttribute('aria-pressed', String(active));
          const enabled = (item.isEnabled ? item.isEnabled(sheet) : true) && (!item.command || sheet.commands.isEnabled(item.command));
          btn.disabled = !enabled;
          break;
        }
        case 'select': {
          const value = item.getValue(sheet);
          if (item.editable) {
            const input = el.querySelector('input') as HTMLInputElement;
            if (document.activeElement !== input) input.value = value;
          } else {
            const select = el as HTMLSelectElement;
            if (!Array.from(select.options).some((o) => o.value === value)) {
              const o = document.createElement('option');
              o.value = value;
              o.textContent = value;
              select.appendChild(o);
            }
            select.value = value;
          }
          break;
        }
        case 'custom':
          item.update?.(sheet, el);
          break;
        default:
          break;
      }
    }
  }

  private createItem(item: ToolbarItem): HTMLElement {
    const sheet = this.sheet;
    switch (item.type) {
      case 'separator': {
        const s = document.createElement('div');
        s.className = 'cui-tb-sep';
        return s;
      }
      case 'button': {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'cui-tb-btn';
        b.dataset.id = item.id;
        b.innerHTML = item.label;
        if (item.title) {
          b.title = item.title;
          b.setAttribute('aria-label', item.title);
        }
        b.addEventListener('click', (e) => {
          if (item.onClick) item.onClick(sheet, e);
          else if (item.command) void sheet.commands.execute(item.command, { args: item.args, event: e });
          this.refresh();
          if (!item.onClick) sheet.focus();
        });
        return b;
      }
      case 'select': {
        if (item.editable) {
          const wrap = document.createElement('div');
          wrap.className = 'cui-tb-combo';
          if (item.width) wrap.style.width = `${item.width}px`;
          const input = document.createElement('input');
          input.type = 'text';
          input.className = 'cui-tb-combo-input';
          if (item.title) {
            input.title = item.title;
            input.setAttribute('aria-label', item.title);
          }
          const listId = `cui-list-${item.id.replace(/[^a-z0-9]/gi, '')}-${Math.random().toString(36).slice(2, 7)}`;
          const list = document.createElement('datalist');
          list.id = listId;
          for (const opt of item.options) {
            const o = document.createElement('option');
            o.value = opt.value;
            o.textContent = opt.label;
            list.appendChild(o);
          }
          input.setAttribute('list', listId);
          const commit = () => {
            item.onChange(sheet, input.value);
            sheet.focus();
          };
          input.addEventListener('change', commit);
          input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              sheet.focus();
            }
          });
          wrap.append(input, list);
          return wrap;
        }
        const select = document.createElement('select');
        select.className = 'cui-tb-select';
        if (item.title) {
          select.title = item.title;
          select.setAttribute('aria-label', item.title);
        }
        if (item.width) select.style.width = `${item.width}px`;
        for (const opt of item.options) {
          const o = document.createElement('option');
          o.value = opt.value;
          o.textContent = opt.label;
          if (opt.style) o.setAttribute('style', opt.style);
          select.appendChild(o);
        }
        select.addEventListener('change', () => {
          item.onChange(sheet, select.value);
          sheet.focus();
        });
        return select;
      }
      case 'custom': {
        const el = item.render(sheet);
        return el;
      }
    }
  }

  destroy(): void {
    this.element.remove();
    this.items = [];
    this.rendered.clear();
  }
}
