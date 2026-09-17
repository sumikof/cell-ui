/** In-cell dropdown list used by list validation rules. */
export interface DropdownOptions {
  options: (string | number)[];
  current?: string;
  host: HTMLElement | ShadowRoot;
  /** Anchor rectangle in viewport coordinates. */
  anchor: { left: number; top: number; width: number; height: number };
  onPick: (value: string | number) => void;
  onClose?: () => void;
}

export function openDropdown(opts: DropdownOptions): () => void {
  const pop = document.createElement('div');
  pop.className = 'cui-popover cui-dropdown';
  pop.setAttribute('role', 'listbox');
  pop.style.minWidth = `${Math.max(opts.anchor.width, 80)}px`;
  const items: HTMLButtonElement[] = [];
  let index = Math.max(0, opts.options.findIndex((o) => String(o) === opts.current));
  const highlight = (i: number) => {
    index = Math.max(0, Math.min(items.length - 1, i));
    items.forEach((b, k) => b.classList.toggle('cui-dropdown-item--active', k === index));
    items[index]?.scrollIntoView?.({ block: 'nearest' });
  };
  opts.options.forEach((o, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cui-dropdown-item';
    b.setAttribute('role', 'option');
    b.textContent = String(o);
    b.addEventListener('mousedown', (e) => e.preventDefault());
    b.addEventListener('mousemove', () => highlight(i));
    b.addEventListener('click', () => {
      opts.onPick(o);
      close();
    });
    items.push(b);
    pop.appendChild(b);
  });
  pop.style.left = `${opts.anchor.left}px`;
  pop.style.top = `${opts.anchor.top + opts.anchor.height}px`;
  opts.host.appendChild(pop);
  const rect = pop.getBoundingClientRect();
  if (rect.bottom > window.innerHeight) pop.style.top = `${Math.max(0, opts.anchor.top - rect.height)}px`;
  if (rect.right > window.innerWidth) pop.style.left = `${Math.max(0, window.innerWidth - rect.width - 4)}px`;
  highlight(index);

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    pop.remove();
    document.removeEventListener('mousedown', onDown, true);
    document.removeEventListener('keydown', onKey, true);
    opts.onClose?.();
  };
  const onDown = (e: MouseEvent) => {
    if (!pop.contains(e.target as Node)) close();
  };
  const onKey = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        highlight(index + 1);
        break;
      case 'ArrowUp':
        highlight(index - 1);
        break;
      case 'Home':
        highlight(0);
        break;
      case 'End':
        highlight(items.length - 1);
        break;
      case 'Enter':
      case 'Tab':
        if (items[index]) opts.onPick(opts.options[index]);
        close();
        break;
      case 'Escape':
        close();
        break;
      default:
        return;
    }
    e.preventDefault();
    e.stopPropagation();
  };
  // Register immediately: the event that opened the list has already passed
  // the document's capture phase, so it cannot re-trigger these handlers, and
  // deferring would let a fast follow-up key press slip through to the grid.
  document.addEventListener('mousedown', onDown, true);
  document.addEventListener('keydown', onKey, true);
  return close;
}
