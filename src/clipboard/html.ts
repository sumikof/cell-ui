import type { BorderLineStyle, BorderStyle, CellData, CellStyle, CellValue } from '../model/types';
import { formatValue, parseInputValue } from '../model/value';

/**
 * Excel-compatible HTML clipboard format.
 *
 * Copy: we emit a `<table>` whose cells carry inline CSS. Excel understands
 * inline `font-*`, `color`, `background`, `text-align`, `vertical-align`,
 * `border-*`, `white-space` and its own `mso-number-format`, so styles survive
 * a paste into Excel. Multi-line text is emitted with `<br>`.
 *
 * Paste: Excel puts a full HTML document on the clipboard where most styling
 * lives in a `<style>` block (`.xl65 {…}`) referenced through `class`, with
 * occasional inline `style` attributes. We resolve class rules, `td`/`tr`
 * defaults and inline styles, and also honour `<b>/<i>/<u>/<s>/<font>` inside
 * cells so that pastes from browsers and other apps work too.
 */

// ---------------------------------------------------------------------------
// Serialise
// ---------------------------------------------------------------------------

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const BORDER_WIDTH_PT: Record<BorderLineStyle, string> = {
  none: '0',
  thin: '.5pt',
  medium: '1.0pt',
  thick: '1.5pt',
  dashed: '.5pt',
  dotted: '.5pt',
  double: '1.5pt',
};

function borderCss(b: BorderStyle | undefined): string | null {
  if (!b || b.style === 'none') return null;
  const lineStyle = b.style === 'thin' || b.style === 'medium' || b.style === 'thick' ? 'solid' : b.style;
  return `${BORDER_WIDTH_PT[b.style]} ${lineStyle} ${b.color || '#000000'}`;
}

/** Inline CSS declarations for a style (used for both the clipboard and the on-screen renderer). */
export function styleToCss(style: CellStyle, options: { forClipboard?: boolean } = {}): string {
  const decl: string[] = [];
  if (style.fontFamily) decl.push(`font-family:${style.fontFamily}`);
  if (style.fontSize) decl.push(`font-size:${style.fontSize}pt`);
  if (style.bold) decl.push('font-weight:bold');
  if (style.italic) decl.push('font-style:italic');
  const deco: string[] = [];
  if (style.underline) deco.push('underline');
  if (style.strikethrough) deco.push('line-through');
  if (deco.length) decl.push(`text-decoration:${deco.join(' ')}`);
  if (style.color) decl.push(`color:${style.color}`);
  if (style.backgroundColor) decl.push(`background:${style.backgroundColor}`);
  if (style.hAlign) decl.push(`text-align:${style.hAlign}`);
  if (style.vAlign) decl.push(`vertical-align:${style.vAlign}`);
  if (style.wrap !== undefined) decl.push(`white-space:${style.wrap ? 'normal' : 'nowrap'}`);
  const bt = borderCss(style.borderTop);
  const br = borderCss(style.borderRight);
  const bb = borderCss(style.borderBottom);
  const bl = borderCss(style.borderLeft);
  if (bt) decl.push(`border-top:${bt}`);
  if (br) decl.push(`border-right:${br}`);
  if (bb) decl.push(`border-bottom:${bb}`);
  if (bl) decl.push(`border-left:${bl}`);
  if (options.forClipboard && style.numberFormat) {
    decl.push(`mso-number-format:"${style.numberFormat.replace(/"/g, '\\"')}"`);
  }
  return decl.join(';');
}

export interface HtmlSerializeOptions {
  columnWidths?: number[];
  rowHeights?: number[];
  /** Custom text for a cell (e.g. formatted numbers). Defaults to `formatValue`. */
  displayText?: (cell: CellData, row: number, col: number) => string;
}

export function serializeHtml(block: CellData[][], options: HtmlSerializeOptions = {}): string {
  const parts: string[] = [];
  parts.push(
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">',
    '<head><meta http-equiv="Content-Type" content="text/html; charset=utf-8"><meta name="ProgId" content="Excel.Sheet"><meta name="Generator" content="cell-ui">',
    '<style>table{border-collapse:collapse}td{white-space:nowrap;vertical-align:bottom;padding:0 3px}</style></head>',
    '<body><table border="0" cellpadding="0" cellspacing="0">',
  );
  if (options.columnWidths) {
    for (const w of options.columnWidths) parts.push(`<col width="${Math.round(w)}" style="width:${Math.round(w * 0.75)}pt">`);
  }
  block.forEach((row, r) => {
    const h = options.rowHeights?.[r];
    parts.push(h ? `<tr height="${Math.round(h)}" style="height:${Math.round(h * 0.75)}pt">` : '<tr>');
    row.forEach((cell, c) => {
      const css = styleToCss(cell.style ?? {}, { forClipboard: true });
      const text = options.displayText ? options.displayText(cell, r, c) : formatValue(cell.value);
      const attrs: string[] = [];
      if (css) attrs.push(`style="${escapeHtml(css)}"`);
      if (typeof cell.value === 'number') attrs.push(`x:num="${cell.value}"`);
      else if (typeof cell.value === 'boolean') attrs.push(`x:bool="${cell.value ? 'TRUE' : 'FALSE'}"`);
      else if (typeof cell.value === 'string' && cell.value !== '') attrs.push('x:str');
      const body = escapeHtml(text).replace(/\r?\n/g, '<br>');
      parts.push(`<td${attrs.length ? ' ' + attrs.join(' ') : ''}>${body}</td>`);
    });
    parts.push('</tr>');
  });
  parts.push('</table></body></html>');
  return parts.join('');
}

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------

type Decls = Record<string, string>;

/** Parse `a:b;c:d` into a map. Handles quoted values (mso-number-format:"0\.00"). */
export function parseDeclarations(css: string): Decls {
  const out: Decls = {};
  let i = 0;
  const n = css.length;
  while (i < n) {
    const colon = css.indexOf(':', i);
    if (colon < 0) break;
    const prop = css.slice(i, colon).trim().toLowerCase();
    i = colon + 1;
    let value = '';
    let quote: string | null = null;
    while (i < n) {
      const ch = css[i];
      if (quote) {
        if (ch === '\\' && i + 1 < n) {
          value += ch + css[i + 1];
          i += 2;
          continue;
        }
        if (ch === quote) quote = null;
        value += ch;
        i++;
        continue;
      }
      if (ch === '"' || ch === "'") {
        quote = ch;
        value += ch;
        i++;
        continue;
      }
      if (ch === ';') {
        i++;
        break;
      }
      value += ch;
      i++;
    }
    if (prop) out[prop] = value.trim();
  }
  return out;
}

interface StyleSheetRules {
  /** Rules by element name (td, tr, table…). */
  elements: Map<string, Decls>;
  /** Rules by class name (without the dot). */
  classes: Map<string, Decls>;
}

/** Very small CSS parser: enough for the `<style>` blocks Excel and browsers emit. */
export function parseStyleSheet(cssText: string): StyleSheetRules {
  const rules: StyleSheetRules = { elements: new Map(), classes: new Map() };
  const text = cssText.replace(/<!--|-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const decls = parseDeclarations(m[2]);
    for (const rawSel of m[1].split(',')) {
      const sel = rawSel.trim();
      if (!sel || sel.startsWith('@')) continue;
      // Only the last compound of a selector matters for our purposes.
      const last = sel.split(/\s+/).pop()!;
      const classMatch = /^\.([\w-]+)$/.exec(last);
      if (classMatch) {
        rules.classes.set(classMatch[1], { ...(rules.classes.get(classMatch[1]) ?? {}), ...decls });
        continue;
      }
      const elMatch = /^([a-zA-Z]+)$/.exec(last);
      if (elMatch) {
        const el = elMatch[1].toLowerCase();
        rules.elements.set(el, { ...(rules.elements.get(el) ?? {}), ...decls });
      }
    }
  }
  return rules;
}

/** CSS named colours plus the system colours Excel emits (`windowtext`, `window`). */
const NAMED_COLOR_ALIASES: Record<string, string> = {
  windowtext: '#000000', window: '#ffffff',
  aliceblue: '#f0f8ff', antiquewhite: '#faebd7', aqua: '#00ffff', aquamarine: '#7fffd4', azure: '#f0ffff', beige: '#f5f5dc', bisque: '#ffe4c4',
  black: '#000000', blanchedalmond: '#ffebcd', blue: '#0000ff', blueviolet: '#8a2be2', brown: '#a52a2a', burlywood: '#deb887', cadetblue: '#5f9ea0',
  chartreuse: '#7fff00', chocolate: '#d2691e', coral: '#ff7f50', cornflowerblue: '#6495ed', cornsilk: '#fff8dc', crimson: '#dc143c', cyan: '#00ffff',
  darkblue: '#00008b', darkcyan: '#008b8b', darkgoldenrod: '#b8860b', darkgray: '#a9a9a9', darkgreen: '#006400', darkgrey: '#a9a9a9', darkkhaki: '#bdb76b',
  darkmagenta: '#8b008b', darkolivegreen: '#556b2f', darkorange: '#ff8c00', darkorchid: '#9932cc', darkred: '#8b0000', darksalmon: '#e9967a',
  darkseagreen: '#8fbc8f', darkslateblue: '#483d8b', darkslategray: '#2f4f4f', darkslategrey: '#2f4f4f', darkturquoise: '#00ced1', darkviolet: '#9400d3',
  deeppink: '#ff1493', deepskyblue: '#00bfff', dimgray: '#696969', dimgrey: '#696969', dodgerblue: '#1e90ff', firebrick: '#b22222', floralwhite: '#fffaf0',
  forestgreen: '#228b22', fuchsia: '#ff00ff', gainsboro: '#dcdcdc', ghostwhite: '#f8f8ff', gold: '#ffd700', goldenrod: '#daa520', gray: '#808080',
  green: '#008000', greenyellow: '#adff2f', grey: '#808080', honeydew: '#f0fff0', hotpink: '#ff69b4', indianred: '#cd5c5c', indigo: '#4b0082',
  ivory: '#fffff0', khaki: '#f0e68c', lavender: '#e6e6fa', lavenderblush: '#fff0f5', lawngreen: '#7cfc00', lemonchiffon: '#fffacd', lightblue: '#add8e6',
  lightcoral: '#f08080', lightcyan: '#e0ffff', lightgoldenrodyellow: '#fafad2', lightgray: '#d3d3d3', lightgreen: '#90ee90', lightgrey: '#d3d3d3',
  lightpink: '#ffb6c1', lightsalmon: '#ffa07a', lightseagreen: '#20b2aa', lightskyblue: '#87cefa', lightslategray: '#778899', lightslategrey: '#778899',
  lightsteelblue: '#b0c4de', lightyellow: '#ffffe0', lime: '#00ff00', limegreen: '#32cd32', linen: '#faf0e6', magenta: '#ff00ff', maroon: '#800000',
  mediumaquamarine: '#66cdaa', mediumblue: '#0000cd', mediumorchid: '#ba55d3', mediumpurple: '#9370db', mediumseagreen: '#3cb371', mediumslateblue: '#7b68ee',
  mediumspringgreen: '#00fa9a', mediumturquoise: '#48d1cc', mediumvioletred: '#c71585', midnightblue: '#191970', mintcream: '#f5fffa', mistyrose: '#ffe4e1',
  moccasin: '#ffe4b5', navajowhite: '#ffdead', navy: '#000080', oldlace: '#fdf5e6', olive: '#808000', olivedrab: '#6b8e23', orange: '#ffa500',
  orangered: '#ff4500', orchid: '#da70d6', palegoldenrod: '#eee8aa', palegreen: '#98fb98', paleturquoise: '#afeeee', palevioletred: '#db7093',
  papayawhip: '#ffefd5', peachpuff: '#ffdab9', peru: '#cd853f', pink: '#ffc0cb', plum: '#dda0dd', powderblue: '#b0e0e6', purple: '#800080',
  rebeccapurple: '#663399', red: '#ff0000', rosybrown: '#bc8f8f', royalblue: '#4169e1', saddlebrown: '#8b4513', salmon: '#fa8072', sandybrown: '#f4a460',
  seagreen: '#2e8b57', seashell: '#fff5ee', sienna: '#a0522d', silver: '#c0c0c0', skyblue: '#87ceeb', slateblue: '#6a5acd', slategray: '#708090',
  slategrey: '#708090', snow: '#fffafa', springgreen: '#00ff7f', steelblue: '#4682b4', tan: '#d2b48c', teal: '#008080', thistle: '#d8bfd8',
  tomato: '#ff6347', turquoise: '#40e0d0', violet: '#ee82ee', wheat: '#f5deb3', white: '#ffffff', whitesmoke: '#f5f5f5', yellow: '#ffff00', yellowgreen: '#9acd32',
};

export function normalizeColor(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const v = value.trim().toLowerCase();
  if (!v || v === 'transparent' || v === 'none' || v === 'inherit' || v === 'initial' || v === 'auto') return undefined;
  if (NAMED_COLOR_ALIASES[v]) return NAMED_COLOR_ALIASES[v];
  const hex3 = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(v);
  if (hex3) return `#${hex3[1]}${hex3[1]}${hex3[2]}${hex3[2]}${hex3[3]}${hex3[3]}`;
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(v);
  if (rgb) {
    if (rgb[4] !== undefined && Number(rgb[4]) === 0) return undefined;
    const hex = (n: string) => Number(n).toString(16).padStart(2, '0');
    return `#${hex(rgb[1])}${hex(rgb[2])}${hex(rgb[3])}`;
  }
  return v;
}

function parseFontSize(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const m = /^([\d.]+)\s*(pt|px|em|rem|%)?$/.exec(value.trim());
  if (!m) return undefined;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return undefined;
  switch (m[2]) {
    case 'px':
      return Math.round(n * 0.75 * 10) / 10;
    case 'em':
    case 'rem':
      return Math.round(n * 11 * 10) / 10;
    case '%':
      return Math.round((n / 100) * 11 * 10) / 10;
    default:
      return n;
  }
}

/** Parse a CSS border shorthand ("0.5pt solid windowtext") into a BorderStyle, or null for "none". */
export function parseBorder(value: string | undefined): BorderStyle | null | undefined {
  if (value === undefined) return undefined;
  const v = value.trim().toLowerCase();
  if (!v || v === 'none' || v === '0' || v === 'hidden' || v === 'initial') return null;
  let widthPt = 0.5;
  let line: string = 'solid';
  let color = '#000000';
  let sawWidth = false;
  let sawStyle = false;
  const tokens = v.match(/rgba?\([^)]*\)|[^\s]+/g) ?? [];
  for (const t of tokens) {
    const w = /^([\d.]+)(pt|px)?$/.exec(t);
    if (w) {
      const n = parseFloat(w[1]);
      widthPt = w[2] === 'px' ? n * 0.75 : n;
      sawWidth = true;
      continue;
    }
    if (['solid', 'dashed', 'dotted', 'double', 'none', 'hidden', 'groove', 'ridge', 'inset', 'outset'].includes(t)) {
      line = t;
      sawStyle = true;
      continue;
    }
    if (t === 'thin' || t === 'medium' || t === 'thick') {
      widthPt = t === 'thin' ? 0.5 : t === 'medium' ? 1 : 1.5;
      sawWidth = true;
      continue;
    }
    const c = normalizeColor(t);
    if (c) color = c;
  }
  if (line === 'none' || line === 'hidden') return null;
  if (!sawWidth && !sawStyle) return null;
  if (widthPt === 0) return null;
  let style: BorderLineStyle;
  if (line === 'dashed' || line === 'dotted' || line === 'double') style = line;
  else if (widthPt >= 1.5) style = 'thick';
  else if (widthPt >= 1) style = 'medium';
  else style = 'thin';
  return { style, color };
}

/** Map CSS declarations onto a CellStyle patch. */
export function declarationsToStyle(decls: Decls, target: CellStyle = {}): CellStyle {
  const fw = decls['font-weight'];
  if (fw !== undefined) {
    const n = parseInt(fw, 10);
    target.bold = fw === 'bold' || fw === 'bolder' || (Number.isFinite(n) && n >= 600);
  }
  const fs = decls['font-style'];
  if (fs !== undefined) target.italic = fs === 'italic' || fs === 'oblique';
  const td = decls['text-decoration'] ?? decls['text-decoration-line'];
  if (td !== undefined) {
    target.underline = /underline/.test(td);
    target.strikethrough = /line-through/.test(td);
  }
  if (decls['color'] !== undefined) {
    const c = normalizeColor(decls['color']);
    if (c) target.color = c;
  }
  const bg = decls['background-color'] ?? decls['background'];
  if (bg !== undefined) {
    // background shorthand may contain images; take the first colour-looking token
    const token = bg.match(/rgba?\([^)]*\)|#[0-9a-fA-F]{3,8}|[a-zA-Z]+/)?.[0];
    const c = normalizeColor(token);
    if (c) target.backgroundColor = c;
  }
  if (decls['font-family'] !== undefined) {
    const fam = decls['font-family'].replace(/["']/g, '').trim();
    if (fam) target.fontFamily = fam;
  }
  const size = parseFontSize(decls['font-size']);
  if (size) target.fontSize = size;
  const ta = decls['text-align'];
  if (ta === 'left' || ta === 'center' || ta === 'right') target.hAlign = ta;
  else if (ta === 'start') target.hAlign = 'left';
  else if (ta === 'end') target.hAlign = 'right';
  const va = decls['vertical-align'];
  if (va === 'top' || va === 'middle' || va === 'bottom') target.vAlign = va;
  const ws = decls['white-space'];
  if (ws !== undefined) {
    if (ws === 'nowrap' || ws === 'pre') target.wrap = false;
    else if (ws === 'normal' || ws === 'pre-wrap' || ws === 'pre-line') target.wrap = true;
  }
  const all = parseBorder(decls['border']);
  const sides: [keyof CellStyle, string][] = [
    ['borderTop', 'border-top'],
    ['borderRight', 'border-right'],
    ['borderBottom', 'border-bottom'],
    ['borderLeft', 'border-left'],
  ];
  for (const [key, prop] of sides) {
    const specific = parseBorder(decls[prop]);
    const b = specific !== undefined ? specific : all;
    if (b === undefined) continue;
    if (b === null) delete (target as Record<string, unknown>)[key];
    else (target as Record<string, unknown>)[key] = b;
  }
  const nf = decls['mso-number-format'];
  if (nf !== undefined) {
    const raw = nf.replace(/^["']|["']$/g, '').replace(/\\(.)/g, '$1');
    if (raw && raw.toLowerCase() !== 'general') target.numberFormat = raw;
  }
  return target;
}

function textOf(node: Node, into: string[]): void {
  if (node.nodeType === 3) {
    into.push((node.textContent ?? '').replace(/ /g, ' '));
    return;
  }
  if (node.nodeType !== 1) return;
  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  if (tag === 'br') {
    into.push('\n');
    return;
  }
  if (tag === 'script' || tag === 'style') return;
  const isBlock = tag === 'p' || tag === 'div';
  if (isBlock && into.length && !into[into.length - 1].endsWith('\n')) into.push('\n');
  for (const child of Array.from(el.childNodes)) textOf(child, into);
}

/** Merge styles implied by inline formatting elements inside a cell (<b>, <font color>, <span style>…). */
function inlineStyle(el: Element, target: CellStyle): void {
  for (const child of Array.from(el.children)) {
    const tag = child.tagName.toLowerCase();
    if (tag === 'b' || tag === 'strong') target.bold = true;
    if (tag === 'i' || tag === 'em') target.italic = true;
    if (tag === 'u') target.underline = true;
    if (tag === 's' || tag === 'strike' || tag === 'del') target.strikethrough = true;
    if (tag === 'font') {
      const color = normalizeColor(child.getAttribute('color') ?? undefined);
      if (color) target.color = color;
      const face = child.getAttribute('face');
      if (face) target.fontFamily = face.replace(/["']/g, '');
    }
    const style = child.getAttribute('style');
    if (style) declarationsToStyle(parseDeclarations(style), target);
    inlineStyle(child, target);
  }
}

export interface ParsedHtmlTable {
  cells: CellData[][];
  columnWidths?: (number | undefined)[];
  rowHeights?: (number | undefined)[];
}

/** Does the HTML fragment contain a table we can import? */
export function htmlHasTable(html: string): boolean {
  return /<table[\s>]/i.test(html);
}

/**
 * Parse the first `<table>` in an HTML clipboard payload into a block of cells.
 * Returns null when there is no table. Merged cells (colspan/rowspan) occupy
 * their full footprint; only the anchor cell carries the value.
 */
export function parseHtmlTable(html: string): ParsedHtmlTable | null {
  if (typeof DOMParser === 'undefined') return null;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const table = doc.querySelector('table');
  if (!table) return null;

  const sheet: StyleSheetRules = { elements: new Map(), classes: new Map() };
  for (const styleEl of Array.from(doc.querySelectorAll('style'))) {
    const parsed = parseStyleSheet(styleEl.textContent ?? '');
    for (const [k, v] of parsed.elements) sheet.elements.set(k, { ...(sheet.elements.get(k) ?? {}), ...v });
    for (const [k, v] of parsed.classes) sheet.classes.set(k, { ...(sheet.classes.get(k) ?? {}), ...v });
  }

  const rows = Array.from(table.querySelectorAll('tr')).filter((tr) => tr.closest('table') === table);
  const grid: (CellData | null)[][] = [];
  const occupied = new Set<string>();
  const rowHeights: (number | undefined)[] = [];

  const elementStyle = (el: Element): CellStyle => {
    const style: CellStyle = {};
    const tag = el.tagName.toLowerCase();
    const tagRules = sheet.elements.get(tag);
    if (tagRules) declarationsToStyle(tagRules, style);
    for (const cls of Array.from(el.classList)) {
      const r = sheet.classes.get(cls);
      if (r) declarationsToStyle(r, style);
    }
    // Presentational attributes
    const bgcolor = normalizeColor(el.getAttribute('bgcolor') ?? undefined);
    if (bgcolor) style.backgroundColor = bgcolor;
    const align = (el.getAttribute('align') ?? '').toLowerCase();
    if (align === 'left' || align === 'center' || align === 'right') style.hAlign = align;
    const valign = (el.getAttribute('valign') ?? '').toLowerCase();
    if (valign === 'top' || valign === 'middle' || valign === 'bottom') style.vAlign = valign;
    const inline = el.getAttribute('style');
    if (inline) declarationsToStyle(parseDeclarations(inline), style);
    return style;
  };

  rows.forEach((tr, r) => {
    grid[r] ??= [];
    const trStyle = elementStyle(tr);
    const h = tr.getAttribute('height');
    rowHeights[r] = h ? parseFloat(h) || undefined : undefined;
    let c = 0;
    for (const td of Array.from(tr.children)) {
      const tag = td.tagName.toLowerCase();
      if (tag !== 'td' && tag !== 'th') continue;
      while (occupied.has(`${r},${c}`)) c++;
      const colspan = Math.max(1, parseInt(td.getAttribute('colspan') ?? '1', 10) || 1);
      const rowspan = Math.max(1, parseInt(td.getAttribute('rowspan') ?? '1', 10) || 1);

      const style: CellStyle = { ...trStyle, ...elementStyle(td) };
      if (tag === 'th' && style.bold === undefined) style.bold = true;
      inlineStyle(td, style);

      const parts: string[] = [];
      textOf(td, parts);
      let text = parts.join('');
      // Collapse whitespace the way browsers render it, but keep explicit line breaks.
      text = text
        .split('\n')
        .map((line) => line.replace(/[ \t\r\f]+/g, ' ').trim())
        .join('\n')
        .replace(/^\n+|\n+$/g, '');

      let value: CellValue;
      const xnum = td.getAttribute('x:num');
      const xbool = td.getAttribute('x:bool');
      if (xnum !== null && xnum !== '') {
        const n = Number(xnum);
        value = Number.isFinite(n) ? n : parseInputValue(text);
      } else if (xnum !== null) {
        const n = Number(text.replace(/,/g, ''));
        value = Number.isFinite(n) && text !== '' ? n : parseInputValue(text);
      } else if (xbool !== null) {
        value = (xbool || text).toUpperCase() === 'TRUE';
      } else if (td.hasAttribute('x:str')) {
        value = text;
      } else {
        value = parseInputValue(text);
        if (typeof value === 'string' && value.startsWith("'")) value = text; // keep literal apostrophes from foreign HTML
      }

      const cell: CellData = { value };
      if (Object.keys(style).length) cell.style = style;
      grid[r][c] = cell;
      for (let dr = 0; dr < rowspan; dr++) {
        for (let dc = 0; dc < colspan; dc++) {
          if (dr === 0 && dc === 0) continue;
          occupied.add(`${r + dr},${c + dc}`);
          grid[r + dr] ??= [];
          grid[r + dr][c + dc] = { value: null };
        }
      }
      c += colspan;
    }
  });

  const width = Math.max(1, ...grid.map((r) => r.length));
  const cells: CellData[][] = grid.map((row) => {
    const out: CellData[] = [];
    for (let i = 0; i < width; i++) out.push(row[i] ?? { value: null });
    return out;
  });

  const columnWidths: (number | undefined)[] = [];
  const cols = Array.from(table.querySelectorAll('col'));
  let ci = 0;
  for (const col of cols) {
    const span = Math.max(1, parseInt(col.getAttribute('span') ?? '1', 10) || 1);
    const w = col.getAttribute('width');
    const px = w ? parseFloat(w) : NaN;
    for (let i = 0; i < span; i++) columnWidths[ci++] = Number.isFinite(px) ? px : undefined;
  }

  return { cells, columnWidths: columnWidths.length ? columnWidths : undefined, rowHeights };
}
