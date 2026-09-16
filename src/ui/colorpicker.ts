import type { Strings } from '../i18n';

/** Excel's theme colours (first row) and standard colours. */
export const THEME_COLORS: string[][] = [
  ['#ffffff', '#000000', '#e7e6e6', '#44546a', '#4472c4', '#ed7d31', '#a5a5a5', '#ffc000', '#5b9bd5', '#70ad47'],
  ['#f2f2f2', '#808080', '#d0cece', '#d6dce4', '#d9e2f3', '#fbe5d5', '#ededed', '#fff2cc', '#deebf6', '#e2efd9'],
  ['#d9d9d9', '#595959', '#aeabab', '#adb9ca', '#b4c6e7', '#f7cbac', '#dbdbdb', '#ffe598', '#bdd7ee', '#c5e0b3'],
  ['#bfbfbf', '#404040', '#757070', '#8496b0', '#8eaadb', '#f4b183', '#c9c9c9', '#ffd965', '#9dc3e6', '#a8d08d'],
  ['#a6a6a6', '#262626', '#3a3838', '#323f4f', '#2f5496', '#c55a11', '#7b7b7b', '#bf9000', '#2e75b5', '#538135'],
  ['#7f7f7f', '#0d0d0d', '#171616', '#222a35', '#1f3864', '#833c0b', '#525252', '#7f6000', '#1e4e79', '#375623'],
];
export const STANDARD_COLORS = ['#c00000', '#ff0000', '#ffc000', '#ffff00', '#92d050', '#00b050', '#00b0f0', '#0070c0', '#002060', '#7030a0'];

export interface ColorPickerOptions {
  strings: Strings;
  /** Label of the "reset" entry: "Automatic" for text, "No fill" for background. */
  resetLabel: string;
  onPick: (color: string | undefined) => void;
  onClose?: () => void;
}

/** Popover palette. Returns the element; caller positions and removes it. */
export function openColorPicker(anchor: HTMLElement, options: ColorPickerOptions): () => void {
  const pop = document.createElement('div');
  pop.className = 'cui-popover cui-colorpicker';
  const swatch = (color: string) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cui-swatch';
    b.style.background = color;
    b.title = color;
    b.addEventListener('mousedown', (e) => e.preventDefault());
    b.addEventListener('click', () => {
      options.onPick(color);
      close();
    });
    return b;
  };
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'cui-popover-item';
  reset.textContent = options.resetLabel;
  reset.addEventListener('mousedown', (e) => e.preventDefault());
  reset.addEventListener('click', () => {
    options.onPick(undefined);
    close();
  });
  pop.appendChild(reset);
  const grid = document.createElement('div');
  grid.className = 'cui-swatch-grid';
  for (const row of THEME_COLORS) for (const c of row) grid.appendChild(swatch(c));
  pop.appendChild(grid);
  const std = document.createElement('div');
  std.className = 'cui-swatch-grid';
  for (const c of STANDARD_COLORS) std.appendChild(swatch(c));
  pop.appendChild(std);
  const more = document.createElement('label');
  more.className = 'cui-popover-item';
  more.textContent = options.strings.moreColors;
  const input = document.createElement('input');
  input.type = 'color';
  input.className = 'cui-color-input';
  input.addEventListener('input', () => {
    options.onPick(input.value);
  });
  input.addEventListener('change', () => close());
  more.appendChild(input);
  pop.appendChild(more);

  const rect = anchor.getBoundingClientRect();
  pop.style.left = `${rect.left}px`;
  pop.style.top = `${rect.bottom + 2}px`;
  document.body.appendChild(pop);
  const pr = pop.getBoundingClientRect();
  if (pr.right > window.innerWidth) pop.style.left = `${Math.max(0, window.innerWidth - pr.width - 4)}px`;

  const onDown = (e: MouseEvent) => {
    if (!pop.contains(e.target as Node) && e.target !== anchor && !anchor.contains(e.target as Node)) close();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    pop.remove();
    document.removeEventListener('mousedown', onDown, true);
    document.removeEventListener('keydown', onKey, true);
    options.onClose?.();
  };
  setTimeout(() => {
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('keydown', onKey, true);
  }, 0);
  return close;
}
