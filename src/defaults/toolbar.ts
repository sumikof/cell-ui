import type { Spreadsheet } from '../spreadsheet';
import type { ToolbarItem } from '../plugins/api';
import type { BorderPreset } from './commands';
import { openColorPicker } from '../ui/colorpicker';

export const FONT_FAMILIES = [
  'Calibri',
  'Arial',
  'Helvetica',
  'Times New Roman',
  'Georgia',
  'Courier New',
  'Verdana',
  'Tahoma',
  'Segoe UI',
  'Meiryo',
  'Yu Gothic',
  'MS PGothic',
  'MS Gothic',
  'MS Mincho',
  'Hiragino Sans',
  'Noto Sans JP',
  'sans-serif',
  'serif',
  'monospace',
];

export const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];

const ICONS = {
  undo: '<svg viewBox="0 0 16 16" width="16" height="16"><path d="M6 3 2 7l4 4V8h4a3 3 0 0 1 0 6H7v2h3a5 5 0 0 0 0-10H6z" fill="currentColor"/></svg>',
  redo: '<svg viewBox="0 0 16 16" width="16" height="16"><path d="m10 3 4 4-4 4V8H6a3 3 0 0 0 0 6h3v2H6A5 5 0 0 1 6 6h4z" fill="currentColor"/></svg>',
  bold: '<b>B</b>',
  italic: '<i>I</i>',
  underline: '<u>U</u>',
  strike: '<s>S</s>',
  alignLeft: '<svg viewBox="0 0 16 16" width="16" height="16"><path d="M2 3h12v1.5H2zM2 6.5h8V8H2zM2 10h12v1.5H2zM2 13.5h8V15H2z" fill="currentColor"/></svg>',
  alignCenter: '<svg viewBox="0 0 16 16" width="16" height="16"><path d="M2 3h12v1.5H2zM4 6.5h8V8H4zM2 10h12v1.5H2zM4 13.5h8V15H4z" fill="currentColor"/></svg>',
  alignRight: '<svg viewBox="0 0 16 16" width="16" height="16"><path d="M2 3h12v1.5H2zM6 6.5h8V8H6zM2 10h12v1.5H2zM6 13.5h8V15H6z" fill="currentColor"/></svg>',
  alignTop: '<svg viewBox="0 0 16 16" width="16" height="16"><path d="M2 2h12v1.5H2zM7 5h2v9H7z" fill="currentColor"/></svg>',
  alignMiddle: '<svg viewBox="0 0 16 16" width="16" height="16"><path d="M2 7.25h12v1.5H2zM7 2h2v4H7zM7 10h2v4H7z" fill="currentColor"/></svg>',
  alignBottom: '<svg viewBox="0 0 16 16" width="16" height="16"><path d="M2 12.5h12V14H2zM7 2h2v9H7z" fill="currentColor"/></svg>',
  wrap: '<svg viewBox="0 0 16 16" width="16" height="16"><path d="M2 3h12v1.5H2zM2 7h9a2.5 2.5 0 0 1 0 5H9.5v1.5L7 11.75 9.5 10v1.5H11a1 1 0 0 0 0-2H2zM2 11h3v1.5H2z" fill="currentColor"/></svg>',
  borders: '<svg viewBox="0 0 16 16" width="16" height="16"><path d="M2 2h12v12H2zm1.5 1.5v4h4v-4zm5.5 0v4h4v-4zm-5.5 5.5v4h4V9zm5.5 0v4h4V9z" fill="currentColor" fill-rule="evenodd"/></svg>',
  fontColor: '<span class="cui-tb-a">A</span>',
  fill: '<svg viewBox="0 0 16 16" width="16" height="16"><path d="M9.5 1.5 14 6l-6 6-4.5-4.5zM3 8.5 8 13.5l-1 1L2 9.5z" fill="currentColor"/><path d="M14.5 10c.8 1.2 1.5 2.2 1.5 3a1.5 1.5 0 0 1-3 0c0-.8.7-1.8 1.5-3z" fill="currentColor"/></svg>',
  clear: '<svg viewBox="0 0 16 16" width="16" height="16"><path d="M9 2 2 9l3 3h6l3-3zm-3.6 8.6L4 9.2 9 4.2l2.8 2.8z" fill="currentColor"/><path d="M2 14h12v1H2z" fill="currentColor"/></svg>',
};

function activeStyle(sheet: Spreadsheet) {
  const a = sheet.selection.active;
  return sheet.model.getEffectiveStyle(a.row, a.col);
}

export function installDefaultToolbar(sheet: Spreadsheet): void {
  const t = sheet.strings;
  const items: ToolbarItem[] = [
    { id: 'undo', type: 'button', order: 0, label: ICONS.undo, title: `${t.undo} (Ctrl+Z)`, command: 'history.undo', isEnabled: (s) => s.model.canUndo },
    { id: 'redo', type: 'button', order: 1, label: ICONS.redo, title: `${t.redo} (Ctrl+Y)`, command: 'history.redo', isEnabled: (s) => s.model.canRedo },
    { id: 'sep0', type: 'separator', order: 2 },
    {
      id: 'fontFamily',
      type: 'select',
      order: 10,
      title: t.fontFamily,
      editable: true,
      width: 150,
      options: FONT_FAMILIES.map((f) => ({ value: f, label: f, style: `font-family:${f}` })),
      getValue: (s) => (activeStyle(s).fontFamily ?? '').split(',')[0].replace(/["']/g, '').trim(),
      onChange: (s, v) => s.applyStyle({ fontFamily: v || undefined }),
    },
    {
      id: 'fontSize',
      type: 'select',
      order: 11,
      title: t.fontSize,
      editable: true,
      width: 56,
      options: FONT_SIZES.map((n) => ({ value: String(n), label: String(n) })),
      getValue: (s) => String(activeStyle(s).fontSize ?? 11),
      onChange: (s, v) => {
        const n = parseFloat(v);
        if (Number.isFinite(n) && n > 0) s.applyStyle({ fontSize: n });
      },
    },
    { id: 'sep1', type: 'separator', order: 12 },
    { id: 'bold', type: 'button', order: 20, label: ICONS.bold, title: `${t.bold} (Ctrl+B)`, command: 'format.toggle', args: 'bold', isActive: (s) => !!activeStyle(s).bold },
    { id: 'italic', type: 'button', order: 21, label: ICONS.italic, title: `${t.italic} (Ctrl+I)`, command: 'format.toggle', args: 'italic', isActive: (s) => !!activeStyle(s).italic },
    { id: 'underline', type: 'button', order: 22, label: ICONS.underline, title: `${t.underline} (Ctrl+U)`, command: 'format.toggle', args: 'underline', isActive: (s) => !!activeStyle(s).underline },
    { id: 'strikethrough', type: 'button', order: 23, label: ICONS.strike, title: `${t.strikethrough} (Ctrl+5)`, command: 'format.toggle', args: 'strikethrough', isActive: (s) => !!activeStyle(s).strikethrough },
    { id: 'sep2', type: 'separator', order: 24 },
    {
      id: 'borders',
      type: 'custom',
      order: 30,
      render: (s) => borderMenuButton(s),
    },
    {
      id: 'fontColor',
      type: 'custom',
      order: 31,
      render: (s) => colorButton(s, 'color', ICONS.fontColor, t.fontColor, t.automatic),
      update: (s, el) => {
        const bar = el.querySelector('.cui-tb-colorbar') as HTMLElement;
        bar.style.background = activeStyle(s).color ?? '#000000';
      },
    },
    {
      id: 'fillColor',
      type: 'custom',
      order: 32,
      render: (s) => colorButton(s, 'backgroundColor', ICONS.fill, t.fillColor, t.noFill),
      update: (s, el) => {
        const bar = el.querySelector('.cui-tb-colorbar') as HTMLElement;
        bar.style.background = activeStyle(s).backgroundColor ?? '#ffff00';
      },
    },
    { id: 'sep3', type: 'separator', order: 33 },
    { id: 'alignTop', type: 'button', order: 40, label: ICONS.alignTop, title: t.alignTop, command: 'format.valign', args: 'top', isActive: (s) => activeStyle(s).vAlign === 'top' },
    { id: 'alignMiddle', type: 'button', order: 41, label: ICONS.alignMiddle, title: t.alignMiddle, command: 'format.valign', args: 'middle', isActive: (s) => activeStyle(s).vAlign === 'middle' },
    { id: 'alignBottom', type: 'button', order: 42, label: ICONS.alignBottom, title: t.alignBottom, command: 'format.valign', args: 'bottom', isActive: (s) => (activeStyle(s).vAlign ?? 'bottom') === 'bottom' },
    { id: 'sep4', type: 'separator', order: 43 },
    { id: 'alignLeft', type: 'button', order: 50, label: ICONS.alignLeft, title: t.alignLeft, command: 'format.align', args: 'left', isActive: (s) => activeStyle(s).hAlign === 'left' },
    { id: 'alignCenter', type: 'button', order: 51, label: ICONS.alignCenter, title: t.alignCenter, command: 'format.align', args: 'center', isActive: (s) => activeStyle(s).hAlign === 'center' },
    { id: 'alignRight', type: 'button', order: 52, label: ICONS.alignRight, title: t.alignRight, command: 'format.align', args: 'right', isActive: (s) => activeStyle(s).hAlign === 'right' },
    { id: 'wrap', type: 'button', order: 53, label: ICONS.wrap, title: t.wrapText, command: 'format.wrap', isActive: (s) => !!activeStyle(s).wrap },
    { id: 'sep5', type: 'separator', order: 54 },
    { id: 'clearFormats', type: 'button', order: 60, label: ICONS.clear, title: t.clearFormats, command: 'cell.clearFormats' },
  ];
  for (const item of items) sheet.toolbar.add(item);
}

function colorButton(sheet: Spreadsheet, key: 'color' | 'backgroundColor', icon: string, title: string, resetLabel: string): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'cui-tb-split';
  const main = document.createElement('button');
  main.type = 'button';
  main.className = 'cui-tb-btn cui-tb-color';
  main.title = title;
  main.setAttribute('aria-label', title);
  main.innerHTML = `${icon}<span class="cui-tb-colorbar"></span>`;
  const arrow = document.createElement('button');
  arrow.type = 'button';
  arrow.className = 'cui-tb-btn cui-tb-arrow';
  arrow.title = title;
  arrow.setAttribute('aria-label', `${title} ▾`);
  arrow.textContent = '▾';
  let last: string | undefined = key === 'color' ? '#ff0000' : '#ffff00';
  main.addEventListener('click', () => {
    sheet.applyStyle({ [key]: last });
    sheet.focus();
  });
  arrow.addEventListener('click', () => {
    openColorPicker(arrow, {
      strings: sheet.strings,
      host: sheet.popoverHost,
      resetLabel,
      onPick: (color) => {
        last = color ?? last;
        sheet.applyStyle({ [key]: color });
        sheet.toolbar.refresh();
      },
      onClose: () => sheet.focus(),
    });
  });
  wrap.append(main, arrow);
  return wrap;
}

function borderMenuButton(sheet: Spreadsheet): HTMLElement {
  const t = sheet.strings;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'cui-tb-btn';
  btn.title = t.borders;
  btn.setAttribute('aria-label', t.borders);
  btn.innerHTML = `${ICONS.borders}<span class="cui-tb-caret">▾</span>`;
  const presets: [BorderPreset, string][] = [
    ['all', t.borderAll],
    ['outside', t.borderOutside],
    ['inside', t.borderInside],
    ['thickOutside', t.borderThickOutside],
    ['top', t.borderTop],
    ['bottom', t.borderBottom],
    ['left', t.borderLeft],
    ['right', t.borderRight],
    ['none', t.borderNone],
  ];
  btn.addEventListener('click', () => {
    const pop = document.createElement('div');
    pop.className = 'cui-popover';
    for (const [preset, label] of presets) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'cui-popover-item';
      item.textContent = label;
      item.addEventListener('mousedown', (e) => e.preventDefault());
      item.addEventListener('click', () => {
        void sheet.commands.execute('format.borders', { args: preset });
        close();
      });
      pop.appendChild(item);
    }
    const rect = btn.getBoundingClientRect();
    pop.style.left = `${rect.left}px`;
    pop.style.top = `${rect.bottom + 2}px`;
    sheet.popoverHost.appendChild(pop);
    const onDown = (e: MouseEvent) => {
      if (!pop.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    const close = () => {
      pop.remove();
      document.removeEventListener('mousedown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
      sheet.focus();
    };
    setTimeout(() => {
      document.addEventListener('mousedown', onDown, true);
      document.addEventListener('keydown', onKey, true);
    }, 0);
  });
  return btn;
}
