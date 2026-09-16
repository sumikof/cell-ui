/** UI strings. Add a locale by registering a full string table via `registerLocale`. */

export interface Strings {
  undo: string;
  redo: string;
  cut: string;
  copy: string;
  paste: string;
  pasteValues: string;
  fontFamily: string;
  fontSize: string;
  bold: string;
  italic: string;
  underline: string;
  strikethrough: string;
  fontColor: string;
  fillColor: string;
  alignLeft: string;
  alignCenter: string;
  alignRight: string;
  alignTop: string;
  alignMiddle: string;
  alignBottom: string;
  wrapText: string;
  borders: string;
  borderAll: string;
  borderOutside: string;
  borderInside: string;
  borderTop: string;
  borderBottom: string;
  borderLeft: string;
  borderRight: string;
  borderThickOutside: string;
  borderNone: string;
  clearFormats: string;
  clearContents: string;
  insertRowsAbove: string;
  insertColumnsLeft: string;
  deleteRows: string;
  deleteColumns: string;
  hideRows: string;
  hideColumns: string;
  unhideRows: string;
  unhideColumns: string;
  automatic: string;
  noFill: string;
  moreColors: string;
  sum: string;
  average: string;
  count: string;
  nameBox: string;
  formulaBar: string;
  autoFitColumn: string;
  autoFitRow: string;
}

const en: Strings = {
  undo: 'Undo',
  redo: 'Redo',
  cut: 'Cut',
  copy: 'Copy',
  paste: 'Paste',
  pasteValues: 'Paste values only',
  fontFamily: 'Font',
  fontSize: 'Font size',
  bold: 'Bold',
  italic: 'Italic',
  underline: 'Underline',
  strikethrough: 'Strikethrough',
  fontColor: 'Font color',
  fillColor: 'Fill color',
  alignLeft: 'Align left',
  alignCenter: 'Center',
  alignRight: 'Align right',
  alignTop: 'Top align',
  alignMiddle: 'Middle align',
  alignBottom: 'Bottom align',
  wrapText: 'Wrap text',
  borders: 'Borders',
  borderAll: 'All borders',
  borderOutside: 'Outside borders',
  borderInside: 'Inside borders',
  borderTop: 'Top border',
  borderBottom: 'Bottom border',
  borderLeft: 'Left border',
  borderRight: 'Right border',
  borderThickOutside: 'Thick outside borders',
  borderNone: 'No border',
  clearFormats: 'Clear formats',
  clearContents: 'Clear contents',
  insertRowsAbove: 'Insert rows',
  insertColumnsLeft: 'Insert columns',
  deleteRows: 'Delete rows',
  deleteColumns: 'Delete columns',
  hideRows: 'Hide rows',
  hideColumns: 'Hide columns',
  unhideRows: 'Unhide rows',
  unhideColumns: 'Unhide columns',
  automatic: 'Automatic',
  noFill: 'No fill',
  moreColors: 'More colors…',
  sum: 'Sum',
  average: 'Average',
  count: 'Count',
  nameBox: 'Name box',
  formulaBar: 'Cell contents',
  autoFitColumn: 'AutoFit column width',
  autoFitRow: 'AutoFit row height',
};

const ja: Strings = {
  undo: '元に戻す',
  redo: 'やり直し',
  cut: '切り取り',
  copy: 'コピー',
  paste: '貼り付け',
  pasteValues: '値のみ貼り付け',
  fontFamily: 'フォント',
  fontSize: 'フォントサイズ',
  bold: '太字',
  italic: '斜体',
  underline: '下線',
  strikethrough: '取り消し線',
  fontColor: 'フォントの色',
  fillColor: '塗りつぶしの色',
  alignLeft: '左揃え',
  alignCenter: '中央揃え',
  alignRight: '右揃え',
  alignTop: '上揃え',
  alignMiddle: '上下中央揃え',
  alignBottom: '下揃え',
  wrapText: '折り返して全体を表示',
  borders: '罫線',
  borderAll: '格子',
  borderOutside: '外枠',
  borderInside: '内側',
  borderTop: '上罫線',
  borderBottom: '下罫線',
  borderLeft: '左罫線',
  borderRight: '右罫線',
  borderThickOutside: '太い外枠',
  borderNone: '枠なし',
  clearFormats: '書式のクリア',
  clearContents: '数式と値のクリア',
  insertRowsAbove: '行の挿入',
  insertColumnsLeft: '列の挿入',
  deleteRows: '行の削除',
  deleteColumns: '列の削除',
  hideRows: '行を非表示',
  hideColumns: '列を非表示',
  unhideRows: '行の再表示',
  unhideColumns: '列の再表示',
  automatic: '自動',
  noFill: '塗りつぶしなし',
  moreColors: 'その他の色…',
  sum: '合計',
  average: '平均',
  count: 'データの個数',
  nameBox: '名前ボックス',
  formulaBar: 'セルの内容',
  autoFitColumn: '列幅の自動調整',
  autoFitRow: '行の高さの自動調整',
};

const locales: Record<string, Strings> = { en, ja };

export function registerLocale(code: string, strings: Strings): void {
  locales[code] = strings;
}

export function getStrings(locale?: string): Strings {
  const code = (locale ?? (typeof navigator !== 'undefined' ? navigator.language : 'en') ?? 'en').toLowerCase();
  if (locales[code]) return locales[code];
  const short = code.split('-')[0];
  return locales[short] ?? en;
}
