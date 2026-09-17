import type { Spreadsheet } from '../spreadsheet';
import type { ContextMenuItem } from '../plugins/api';

/** Right-click context menu. Items are contributed through `add()`. */
export class ContextMenu {
  private items: ContextMenuItem[] = [];
  private element: HTMLElement | null = null;
  private onDocMouseDown = (e: MouseEvent) => {
    if (this.element && !this.element.contains(e.target as Node)) this.hide();
  };
  private onDocKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this.hide();
  };

  constructor(private readonly sheet: Spreadsheet) {}

  add(item: ContextMenuItem): () => void {
    this.items.push(item);
    return () => this.remove(item.id);
  }

  remove(id: string): void {
    this.items = this.items.filter((i) => i.id !== id);
  }

  list(): ContextMenuItem[] {
    return [...this.items].sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
  }

  get isOpen(): boolean {
    return this.element !== null;
  }

  show(clientX: number, clientY: number): void {
    this.hide();
    if (this.sheet.options.contextMenu === false) return;
    const sheet = this.sheet;
    const menu = document.createElement('div');
    menu.className = 'cui-menu';
    menu.setAttribute('role', 'menu');
    let lastSeparator = true;
    for (const item of this.list()) {
      if (item.isVisible && !item.isVisible(sheet)) continue;
      if (item.separator) {
        if (lastSeparator) continue;
        const sep = document.createElement('div');
        sep.className = 'cui-menu-separator';
        menu.appendChild(sep);
        lastSeparator = true;
        continue;
      }
      lastSeparator = false;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cui-menu-item';
      btn.setAttribute('role', 'menuitem');
      const enabled = (item.isEnabled ? item.isEnabled(sheet) : true) && (!item.command || sheet.commands.isEnabled(item.command));
      btn.disabled = !enabled;
      const label = document.createElement('span');
      label.className = 'cui-menu-label';
      label.textContent = item.label ?? item.id;
      btn.appendChild(label);
      if (item.shortcut) {
        const sc = document.createElement('span');
        sc.className = 'cui-menu-shortcut';
        sc.textContent = item.shortcut;
        btn.appendChild(sc);
      }
      btn.addEventListener('mousedown', (e) => e.preventDefault());
      btn.addEventListener('click', () => {
        this.hide();
        sheet.focus();
        if (item.run) item.run(sheet);
        else if (item.command) void sheet.commands.execute(item.command, { args: item.args });
      });
      menu.appendChild(btn);
    }
    // Trim trailing separator
    if (menu.lastElementChild?.classList.contains('cui-menu-separator')) menu.lastElementChild.remove();
    menu.style.left = `${clientX}px`;
    menu.style.top = `${clientY}px`;
    this.sheet.popoverHost.appendChild(menu);
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = `${Math.max(0, clientX - rect.width)}px`;
    if (rect.bottom > window.innerHeight) menu.style.top = `${Math.max(0, clientY - rect.height)}px`;
    this.element = menu;
    setTimeout(() => {
      document.addEventListener('mousedown', this.onDocMouseDown, true);
      document.addEventListener('keydown', this.onDocKeyDown, true);
    }, 0);
  }

  hide(): void {
    if (!this.element) return;
    this.element.remove();
    this.element = null;
    document.removeEventListener('mousedown', this.onDocMouseDown, true);
    document.removeEventListener('keydown', this.onDocKeyDown, true);
  }

  destroy(): void {
    this.hide();
    this.items = [];
  }
}
