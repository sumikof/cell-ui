import { Spreadsheet } from '../src';
import { formulaPlugin } from './formula-plugin';

const sheet = new Spreadsheet(document.getElementById('app')!, {
  rows: 500,
  cols: 40,
  locale: 'ja',
});

// Sample data
const headers = ['商品', '数量', '単価', '金額', 'メモ'];
headers.forEach((h, c) => sheet.model.setCell(0, c, { value: h, style: { bold: true, backgroundColor: '#217346', color: '#ffffff', hAlign: 'center' } }));
const rows: [string, number, number, string][] = [
  ['りんご', 12, 120, '長野産'],
  ['みかん', 30, 80, ''],
  ['バナナ', 8, 150, '特売'],
  ['ぶどう', 3, 980, ''],
];
rows.forEach(([name, qty, price, memo], i) => {
  sheet.model.setCell(i + 1, 0, { value: name });
  sheet.model.setCell(i + 1, 1, { value: qty });
  sheet.model.setCell(i + 1, 2, { value: price, style: { color: '#c00000' } });
  sheet.model.setCell(i + 1, 3, { value: qty * price, style: { bold: true } });
  sheet.model.setCell(i + 1, 4, { value: memo, style: { italic: true, color: '#7f7f7f' } });
});
sheet.model.setCell(6, 0, { value: '合計', style: { bold: true, borderTop: { style: 'medium', color: '#000000' } } });
sheet.model.setCell(6, 3, { value: rows.reduce((s, r) => s + r[1] * r[2], 0), style: { bold: true, borderTop: { style: 'medium', color: '#000000' }, backgroundColor: '#fff2cc' } });
sheet.model.setCell(8, 0, { value: '折り返しテキストのサンプルです。セルの幅を超える長い文章も折り返して表示できます。', style: { wrap: true, vAlign: 'top' } });
sheet.model.setRowHeight(8, 60);
sheet.model.setColumnWidth(0, 120);
sheet.model.setColumnWidth(4, 140);
sheet.model.clearHistory();
sheet.focus();

const formulas = document.getElementById('formulas') as HTMLInputElement;
formulas.addEventListener('change', () => {
  if (formulas.checked) sheet.use(formulaPlugin);
  else sheet.removePlugin(formulaPlugin.name);
  sheet.focus();
});
document.getElementById('export')!.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(sheet.toJSON(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'sheet.json';
  a.click();
  sheet.focus();
});
document.getElementById('clear')!.addEventListener('click', () => {
  sheet.load({ cells: {} });
  sheet.focus();
});

// Expose for debugging in the console.
(window as unknown as { sheet: Spreadsheet }).sheet = sheet;
